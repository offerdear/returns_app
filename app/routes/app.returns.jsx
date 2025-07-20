import { Page, Layout, Card, Button, Text, TextField, BlockStack, InlineStack, AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { useState } from "react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";

// Loader: fetch all return requests
export const loader = async () => {
  const { getReturnRequests } = await import("../db.server");
  const requests = await getReturnRequests();
  return json({ 
    requests,
    polarisTranslations 
  });
}

// Action: handle form submission
export async function action({ request }) {
  const { createReturnRequest, createRefund, updateReturnRequestStatus } = await import("../db.server");
  const { authenticate } = await import("../shopify.server");
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const customerId = formData.get("customerId");
  const orderId = formData.get("orderId");
  const shopifyOrderGID = `gid://shopify/Order/${orderId}`;
  const reason = formData.get("reason");
  const refundAmount = parseFloat(formData.get("refundAmount"));

  try {
    // 1. Fetch order details from Shopify
    const orderDetailsResponse = await admin.graphql(
      `query getOrder($id: ID!) {
        order(id: $id) {
          id
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                quantity
                discountedTotalSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
          }
          shippingLine {
            discountedPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }`,
      { variables: { id: shopifyOrderGID } }
    );
    const orderData = await orderDetailsResponse.json();
    const order = orderData.data.order;

    // Check if order exists and has valid pricing data
    if (!order || !order.totalPriceSet || !order.totalPriceSet.shopMoney) {
      return json({ 
        error: "Invalid order. Please check that the Order ID is correct and the order has been paid." 
      }, { status: 400 });
    }

    // Calculate refund amount (total minus shipping)
    const total = parseFloat(order.totalPriceSet.shopMoney.amount);
    const shipping = order.shippingLine ? parseFloat(order.shippingLine.discountedPriceSet.shopMoney.amount) : 0;
    const calculatedRefundAmount = total - shipping;
    console.log("Calculated refund amount:", calculatedRefundAmount);

  // 2. Store in your database
  const returnRequest = await createReturnRequest({
    customerId,
    orderId,
    reason,
    receipts: [],
    refunded: false, // Will be updated after successful refund
    refundAmount: calculatedRefundAmount,
  });

  // 2. Add a tag to the Shopify order
  await admin.graphql(
    `mutation addTagToOrder($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        id: shopifyOrderGID, // This should be the Shopify order GID
        tags: ["Return Requested"],
      },
    }
  );

  // Optionally, add a note as well
  await admin.graphql(
    `mutation updateOrder($input: OrderInput!) {
      orderUpdate(input: $input) {
        order { id note }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          id: shopifyOrderGID,
          note: `Return requested: ${reason}`,
        },
      },
    }
  );

  // Shopify refund mutation
  const refundResponse = await admin.graphql(
    `mutation refundCreate($input: RefundInput!) {
      refundCreate(input: $input) {
        refund {
          createdAt
          id
          note
          order {
            id
            name
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: {
          orderId: shopifyOrderGID,
          refundLineItems: order.lineItems.edges.map(({ node }) => ({
            lineItemId: node.id,
            quantity: node.quantity,
          })),
        },
      },
    }
  );

  const refundData = await refundResponse.json();
  
  // Check for refund errors
  if (refundData.data?.refundCreate?.userErrors?.length > 0) {
    const errors = refundData.data.refundCreate.userErrors;
    console.error("Refund errors:", errors);
    return json({ 
      error: `Refund failed: ${errors.map(e => e.message).join(', ')}` 
    }, { status: 400 });
  }

  const refund = refundData.data?.refundCreate?.refund;
  if (!refund) {
    return json({ 
      error: "Failed to create refund. Please try again." 
    }, { status: 500 });
  }

  // 3. Create refund record in database
  await createRefund({
    returnRequestId: returnRequest.id,
    shopifyRefundId: refund.id,
    amount: calculatedRefundAmount,
    currency: order.totalPriceSet.shopMoney.currencyCode,
    status: 'success',
    processedAt: new Date(),
  });

    // 4. Update return request status to refunded
  await updateReturnRequestStatus(returnRequest.id, 'refunded', true);

  // 5. Update order status to "refunded" in Shopify
  await admin.graphql(
    `mutation orderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order { 
          id 
          financialStatus
          note 
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          id: shopifyOrderGID,
          financialStatus: "REFUNDED",
          note: `Return processed and refunded: ${reason}. Refund amount: ${calculatedRefundAmount} ${order.totalPriceSet.shopMoney.currencyCode}`,
        },
      },
    }
  );

  return redirect("/app/returns");
  } catch (error) {
    console.error("Error processing return request:", error);
    return json({ 
      error: "An error occurred while processing your return request. Please try again." 
    }, { status: 500 });
  }
}

export default function Returns() {
  const { requests, polarisTranslations } = useLoaderData();
  const navigation = useNavigation();
  const actionData = useActionData();
  const isSubmitting = navigation.state === "submitting";
  
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <Page title="Returns Management">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="400">
                <Text variant="headingMd">Welcome to your returns dashboard!</Text>
                <Text variant="bodyMd">Submit and view return requests below.</Text>
                {actionData?.error && (
                  <Text variant="bodyMd" tone="critical">
                    {actionData.error}
                  </Text>
                )}
                <Form method="post">
                  <BlockStack gap="300">
                    <TextField 
                      name="customerId" 
                      label="Customer ID" 
                      value={customerId}
                      onChange={setCustomerId}
                      autoComplete="off" 
                      required 
                    />
                    <TextField 
                      name="orderId" 
                      label="Order ID" 
                      value={orderId}
                      onChange={setOrderId}
                      autoComplete="off" 
                      required 
                    />
                    <TextField 
                      name="reason" 
                      label="Reason" 
                      value={reason}
                      onChange={setReason}
                      autoComplete="off" 
                      required 
                    />
                    <InlineStack gap="200">
                      <Button submit primary loading={isSubmitting}>
                        Submit Return Request
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="300">
                <Text variant="headingMd">All Requests</Text>
                {requests.length === 0 ? (
                  <Text>No return requests found.</Text>
                ) : (
                  <BlockStack as="ul" gap="200">
                    {requests.map((req) => (
                      <li key={req.id} style={{ listStyle: "none" }}>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" as="span">
                            <b>Customer:</b> {req.customerId} &nbsp; <b>Order:</b> {req.orderId}
                          </Text>
                          <Text variant="bodySm" as="span">
                            <b>Reason:</b> {req.reason} &nbsp; <b>Status:</b> {req.status}
                          </Text>
                          <Text variant="bodySm" as="span">
                            <b>Refund Amount:</b> {req.refundAmount}
                          </Text>
                          {req.refunds && req.refunds.length > 0 && (
                            <Text variant="bodySm" as="span">
                              <b>Refund Status:</b> {req.refunds[0].status} - {req.refunds[0].processedAt ? new Date(req.refunds[0].processedAt).toLocaleDateString() : 'Pending'}
                            </Text>
                          )}
                        </BlockStack>
                      </li>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </PolarisAppProvider>
  );
}
