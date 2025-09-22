import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text } from "@shopify/polaris";

export const loader = async ({ request, params }) => {
  console.log('🔄 Order detail loader called with params:', params);
  
  try {
    const { authenticate } = await import("../shopify.server");
    const { admin } = await authenticate.admin(request);
    
    const orderId = params.orderId;
    console.log('🔄 Order ID from params:', orderId);
    
    // Just return the order ID for testing - no GraphQL query
    return json({ orderId });
  } catch (error) {
    console.error('❌ Order detail loader error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};

export default function OrderDetailPage() {
  const { orderId, error } = useLoaderData();
  
  console.log('🔄 Order detail component rendered with:', { orderId, error });
  
  if (error) {
    return (
      <Page title="Error">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Text variant="headingLg" color="critical">Error: {error}</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  return (
    <Page title="Order Detail Test">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingLg" as="h1" alignment="center">
              THE PAGE IS LOADED
            </Text>
            <Text variant="headingMd" as="h2" alignment="center">
              Order ID: {orderId}
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 