import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Page, Layout, Card, Text, Badge, DataTable } from "@shopify/polaris";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  console.log('🔄 Orders loader called');
  console.log('🔄 Request URL:', request.url);
  
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
                  id
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
        customerDisplay: node.customer
          ? `${node.customer.firstName || ""} ${node.customer.lastName || ""} (${node.customer.email || ""})`
          : "Guest",
        customerId: node.customer ? node.customer.id : "",
      }));

      allOrders.push(...orders);

      hasNextPage = data.data.orders.pageInfo.hasNextPage;
      endCursor = data.data.orders.pageInfo.endCursor;
    }

    console.log('🔄 Orders loaded:', allOrders.length);
    return json({ orders: allOrders });
  } catch (error) {
    console.error('❌ Orders loader error:', error);
    return json({ orders: [], error: error.message }, { status: 500 });
  }
};

export default function OrdersPage() {
  const { orders, error } = useLoaderData();

  useEffect(() => {
    console.log('🔄 Orders component mounted');
    console.log('🔄 Orders data:', orders);
    
    // Add browser console logs
    if (typeof window !== 'undefined') {
      console.log('🌐 Browser: Orders page loaded');
      console.log('🌐 Browser: Current URL:', window.location.href);
      
      // Track navigation events
      const handlePopState = () => {
        console.log('🌐 Browser: Navigation occurred, new URL:', window.location.href);
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [orders]);

  const handleOrderClick = (orderId, orderName) => {
    console.log('🔄 Order clicked:', orderId, orderName);
    const orderIdShort = orderId.split('/').pop();
    console.log('🔄 Short order ID:',orderIdShort);
    console.log('🔄 Target URL:', `/app/orders/${orderIdShort}`);
    
    // Add browser console log
    if (typeof window !== 'undefined') {
      console.log('🌐 Browser: About to navigate to:', `/app/orders/${orderIdShort}`);
    }
  };

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
                "ID",
                "Customer ID",
              ]}
              rows={orders.map(order => [
                <Link 
                  key={order.id} 
                  to={`/app/orders/${order.id.split('/').pop()}`}
                  onClick={() => handleOrderClick(order.id, order.name)}
                  style={{ 
                    color: 'var(--p-action-primary)', 
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  {order.name}
                </Link>,
                new Date(order.createdAt).toLocaleString(),
                order.customerDisplay,
                order.total,
                <Badge status={order.financialStatus === "PAID" ? "success" : "attention"}>
                  {order.financialStatus}
                </Badge>,
                <Badge status={order.fulfillmentStatus === "FULFILLED" ? "success" : "warning"}>
                  {order.fulfillmentStatus}
                </Badge>,
                order.id,
                order.customerId,
              ])}
            />
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
