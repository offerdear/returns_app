import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Badge, 
  Button, 
  BlockStack, 
  InlineStack,
  Thumbnail,
  TextField,
  Select,
  AppProvider as PolarisAppProvider
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";

export const loader = async ({ request, params }) => {
  try {

    // TEST
    console.log('🔄 LOADER CALLED with orderId:', params.orderId);
    console.log('🔄 Full URL:', request.url);
    
    const { authenticate } = await import("../../../shopify.server");
    const { admin } = await authenticate.admin(request);

    const orderId = params.orderId;
    const shopifyOrderGID = `gid://shopify/Order/${orderId}`;
    const url = new URL(request.url);
    const selectedItemsParam = url.searchParams.get('items');

    if (!selectedItemsParam) {
      throw new Error("No items selected for return");
    }

    const selectedItemIds = selectedItemsParam.split(',');

    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            firstName
            lastName
            email
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                name
                quantity
                sku
                variant {
                  id
                  title
                  price
                  image {
                    url
                    altText
                  }
                }
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { id: shopifyOrderGID }
    });
    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map(e => e.message).join("; "));
    }

    const order = data.data.order;
    if (!order) {
      throw new Error("Order not found");
    }

    // Filter line items to only include selected ones
    const selectedItems = order.lineItems.edges
      .map(({ node }) => node)
      .filter(item => selectedItemIds.includes(item.id));

    // Calculate total refund amount
    const totalRefundAmount = selectedItems.reduce((sum, item) => {
      return sum + parseFloat(item.discountedTotalSet?.shopMoney?.amount || 0);
    }, 0);

    return json({ 
      order,
      selectedItems,
      totalRefundAmount,
      polarisTranslations 
    });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
};

export default function ReturnProcessingPage() {
  const { order, selectedItems, totalRefundAmount, error, polarisTranslations } = useLoaderData();
  const [searchParams] = useSearchParams();

  if (error) {
    return (
      <PolarisAppProvider i18n={polarisTranslations}>
        <Page title="Process Return">
          <Layout>
            <Layout.Section>
              <Card sectioned>
                <Text color="critical">Error: {error}</Text>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </PolarisAppProvider>
    );
  }

  const returnReasons = [
    { label: "Select a reason", value: "" },
    { label: "Defective product", value: "defective" },
    { label: "Wrong item received", value: "wrong_item" },
    { label: "Item not as described", value: "not_as_described" },
    { label: "Changed mind", value: "changed_mind" },
    { label: "Size doesn't fit", value: "size_issue" },
    { label: "Quality issues", value: "quality_issues" },
    { label: "Other", value: "other" }
  ];

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <Page 
        title={`Process Return - ${order.name}`}
        backAction={{ 
          content: "Back to Order", 
          url: `/app/orders/${order.id.split('/').pop()}` 
        }}
      >
        <Layout>
          {/* Return Summary */}
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="400">
                <Text variant="headingMd">Return Summary</Text>
                <InlineStack gap="400" align="space-between">
                  <BlockStack gap="200">
                    <Text variant="bodyMd">
                      <strong>Order:</strong> {order.name}
                    </Text>
                    <Text variant="bodyMd">
                      <strong>Customer:</strong> {order.customer?.firstName} {order.customer?.lastName}
                    </Text>
                    <Text variant="bodyMd">
                      <strong>Items to Return:</strong> {selectedItems.length}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200" align="end">
                    <Text variant="headingMd" tone="success">
                      Refund Amount: {totalRefundAmount.toFixed(2)} {order.totalPriceSet?.shopMoney?.currencyCode}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Selected Items */}
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="400">
                <Text variant="headingMd">Items Being Returned</Text>
                
                <BlockStack gap="300">
                  {selectedItems.map((item) => (
                    <Card key={item.id} sectioned>
                      <InlineStack gap="400" align="start">
                        <Thumbnail
                          source={item.variant?.image?.url || ""}
                          alt={item.variant?.image?.altText || item.name}
                          size="small"
                        />
                        <BlockStack gap="200" style={{ flex: 1 }}>
                          <Text variant="bodyMd" fontWeight="semibold">
                            {item.name}
                          </Text>
                          {item.variant?.title && item.variant.title !== "Default Title" && (
                            <Text variant="bodySm" tone="subdued">
                              Variant: {item.variant.title}
                            </Text>
                          )}
                          {item.sku && (
                            <Text variant="bodySm" tone="subdued">
                              SKU: {item.sku}
                            </Text>
                          )}
                          <Text variant="bodySm">
                            Quantity: {item.quantity}
                          </Text>
                          <Text variant="bodyMd" fontWeight="semibold">
                            {item.discountedTotalSet?.shopMoney?.amount} {item.discountedTotalSet?.shopMoney?.currencyCode}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Return Form */}
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="400">
                <Text variant="headingMd">Return Details</Text>
                
                <BlockStack gap="300">
                  <Select
                    label="Return Reason"
                    options={returnReasons}
                    placeholder="Select a reason for the return"
                  />
                  
                  <TextField
                    label="Additional Notes"
                    multiline={3}
                    placeholder="Please provide any additional details about the return..."
                  />

                  <TextField
                    label="Customer ID"
                    value={order.customer?.id || ""}
                    readOnly
                    helpText="This will be used to process the return"
                  />

                  <TextField
                    label="Order ID"
                    value={order.id.split('/').pop()}
                    readOnly
                    helpText="Shopify order ID"
                  />

                  <TextField
                    label="Refund Amount"
                    value={`${totalRefundAmount.toFixed(2)} ${order.totalPriceSet?.shopMoney?.currencyCode}`}
                    readOnly
                    helpText="Total amount to be refunded (excluding shipping)"
                  />
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Action Buttons */}
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="400">
                <Text variant="headingMd">Process Return</Text>
                <Text variant="bodyMd" tone="subdued">
                  Review the return details above. The return functionality will be implemented in the next phase.
                </Text>
                
                <InlineStack gap="300">
                  <Button 
                    primary 
                    disabled
                    loading={false}
                  >
                    Process Return & Issue Refund
                  </Button>
                  <Button 
                    url={`/app/orders/${order.id.split('/').pop()}`}
                  >
                    Cancel
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Information Notice */}
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="300">
                <Text variant="headingMd">Return Process Information</Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd">
                    • The refund will be processed through Shopify's payment system
                  </Text>
                  <Text variant="bodyMd">
                    • The order will be tagged with "Return Requested" in Shopify
                  </Text>
                  <Text variant="bodyMd">
                    • A return request record will be created in the database
                  </Text>
                  <Text variant="bodyMd">
                    • The customer will receive an email confirmation
                  </Text>
                  <Text variant="bodyMd">
                    • The order status will be updated to "Refunded"
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </PolarisAppProvider>
  );
} 