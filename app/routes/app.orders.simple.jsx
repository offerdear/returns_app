import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text } from "@shopify/polaris";

export const loader = async ({ request }) => {
  console.log('🔄 Simple orders loader called');
  console.log('🔄 Request URL:', request.url);
  
  try {
    // Test Shopify authentication
    const { authenticate } = await import("../shopify.server");
    console.log('🔄 Shopify import successful');
    
    const { admin } = await authenticate.admin(request);
    console.log('🔄 Shopify admin authenticated');
    
    // Test a simple GraphQL query
    const testQuery = `{
      shop {
        name
        id
      }
    }`;
    
    console.log('🔄 Testing GraphQL connection...');
    const response = await admin.graphql(testQuery);
    const data = await response.json();
    
    console.log('🔄 GraphQL test successful:', data);
    
    return json({ 
      message: "Simple orders page loaded successfully",
      shopName: data.data.shop.name,
      shopId: data.data.shop.id
    });
  } catch (error) {
    console.error('❌ Simple orders loader error:', error);
    return json({ 
      message: "Error occurred",
      error: error.message 
    }, { status: 500 });
  }
};

export default function SimpleOrdersPage() {
  const { message, shopName, shopId, error } = useLoaderData();
  
  console.log('🔄 Simple orders component rendered');

  return (
    <Page title="Simple Orders Test">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingMd">{message}</Text>
            {shopName && (
              <Text variant="bodyMd">Shop: {shopName} ({shopId})</Text>
            )}
            {error && (
              <Text variant="bodyMd" tone="critical">Error: {error}</Text>
            )}
            <Text variant="bodyMd">This is a test page to verify routing and Shopify API are working.</Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}