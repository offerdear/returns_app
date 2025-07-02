import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Badge, DataTable } from "@shopify/polaris";

export const loader = async ({ request }) => {
  // Import authenticate inside the loader (server-only)
  const { authenticate } = await import("../shopify.server");
  const { admin } = await authenticate.admin(request);

  // Fetch orders from Shopify
  const response = await admin.graphql(`
    {
      orders(first: 50, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
            displayFinancialStatus
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
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    price
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const orders = data.data.orders.edges.map(({ node }) => ({
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    fulfillmentStatus: node.displayFulfillmentStatus,
    financialStatus: node.displayFinancialStatus,
    total: `${node.totalPriceSet.shopMoney.amount} ${node.totalPriceSet.shopMoney.currencyCode}`,
    customer: node.customer
      ? `${node.customer.firstName || ""} ${node.customer.lastName || ""} (${node.customer.email || ""})`
      : "Guest",
    lineItems: node.lineItems.edges.map(({ node: item }) => ({
      title: item.title,
      quantity: item.quantity,
      price: item.variant?.price,
    })),
  }));

  return json({ orders });
};

export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <Page title="All Orders">
      <Layout>
        <Layout.Section>
          {orders.length === 0 ? (
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
              ]}
              headings={[
                "Order",
                "Date",
                "Customer",
                "Total",
                "Financial Status",
                "Fulfillment Status",
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
              ])}
            />
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
