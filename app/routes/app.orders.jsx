import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Badge, DataTable } from "@shopify/polaris";

export const loader = async ({ request }) => {
  try {
    const { authenticate } = await import("../shopify.server");
    const { admin } = await authenticate.admin(request);

    let hasNextPage = true;
    let endCursor = null;
    const allOrders = [];

    while (hasNextPage) {
      const query = `
        {
          orders(first: 100${endCursor ? `, after: "${endCursor}"` : ""}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
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
                  firstName
                  lastName
                  email
                }
              }
            }
          }
        }
      `;

      const response = await admin.graphql(query);
      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors.map(e => e.message).join("; "));
      }

      const orders = data.data.orders.edges.map(({ node }) => ({
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        financialStatus: node.displayFinancialStatus,
        fulfillmentStatus: node.displayFulfillmentStatus,
        total: node.totalPriceSet?.shopMoney
          ? `${node.totalPriceSet.shopMoney.amount} ${node.totalPriceSet.shopMoney.currencyCode}`
          : "N/A",
        customer: node.customer
          ? `${node.customer.firstName || ""} ${node.customer.lastName || ""} (${node.customer.email || ""})`
          : "Guest",
      }));

      allOrders.push(...orders);

      hasNextPage = data.data.orders.pageInfo.hasNextPage;
      endCursor = data.data.orders.pageInfo.endCursor;
    }

    return json({ orders: allOrders });
  } catch (error) {
    return json({ orders: [], error: error.message }, { status: 500 });
  }
};

export default function OrdersPage() {
  const { orders, error } = useLoaderData();

  return (
    <Page title="All Orders">
      <Layout>
        <Layout.Section>
          {error && (
            <Card sectioned>
              <Text color="critical">Error: {error}</Text>
            </Card>
          )}
          {orders.length === 0 && !error ? (
            <Text>No orders found.</Text>
          ) : (
            <DataTable
              columnContentTypes={[
                "text",
                "text",
                "text",
                "text",
                "text",
                "text",
                "text"
              ]}
              headings={[
                "Order",
                "Date",
                "Customer",
                "Total",
                "Financial Status",
                "Fulfillment Status",
                "ID"
              ]}
              rows={orders.map(order => [
                order.name,
                new Date(order.createdAt).toLocaleString(),
                order.customer,
                order.total,
                <Badge status={order.financialStatus === "PAID" ? "success" : "attention"}>
                  {order.financialStatus}
                </Badge>,
                <Badge status={order.fulfillmentStatus === "FULFILLED" ? "success" : "warning"}>
                  {order.fulfillmentStatus}
                </Badge>,
                order.id,
              ])}
            />
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
