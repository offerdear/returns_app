import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, DataTable, Badge, BlockStack, InlineStack, ProgressBar, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    // Get all return requests with refunds
    const returnRequests = await prisma.returnRequest.findMany({
      include: {
        refunds: true,
      },
    });

    // Get all products for reference
    const products = await prisma.product.findMany();

    // Get total orders count from Shopify
    let totalOrders = 0;
    try {
      const ordersResponse = await admin.graphql(`
        {
          orders(first: 1) {
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `);
      const ordersData = await ordersResponse.json();
      
      // Get actual order count (this is a simplified approach)
      // In production, you might want to implement pagination to get the real count
      const allOrdersResponse = await admin.graphql(`
        {
          orders(first: 250) {
            edges {
              node {
                id
                name
                lineItems(first: 10) {
                  edges {
                    node {
                      product {
                        id
                        title
                        productType
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `);
      const allOrdersData = await allOrdersResponse.json();
      totalOrders = allOrdersData.data.orders.edges.length;
      
      // Extract product information from orders for better analytics
      const orderProducts = {};
      allOrdersData.data.orders.edges.forEach(({ node }) => {
        node.lineItems.edges.forEach(({ node: lineItem }) => {
          if (lineItem.product) {
            const productId = lineItem.product.id;
            if (!orderProducts[productId]) {
              orderProducts[productId] = {
                title: lineItem.product.title,
                productType: lineItem.product.productType,
                totalOrders: 0,
                returns: 0
              };
            }
            orderProducts[productId].totalOrders++;
          }
        });
      });

      // Match return requests with products
      returnRequests.forEach(req => {
        // This is a simplified matching - in reality you'd want to match by actual product IDs
        Object.keys(orderProducts).forEach(productId => {
          if (req.orderId.includes(productId.split('/').pop())) {
            orderProducts[productId].returns++;
          }
        });
      });

    } catch (shopifyError) {
      console.error('Error fetching Shopify data:', shopifyError);
      totalOrders = returnRequests.length + 50; // Fallback
    }

    // Calculate analytics
    const analytics = calculateAnalytics(returnRequests, products, totalOrders);

    return json({ 
      analytics,
      totalOrders,
      totalProducts: products.length,
      returnRequests: returnRequests.length,
    });
  } catch (error) {
    console.error('Analytics loader error:', error);
    return json({ 
      analytics: {},
      totalOrders: 0,
      totalProducts: 0,
      returnRequests: 0,
      error: error.message 
    }, { status: 500 });
  }
};

function calculateAnalytics(returnRequests, products, totalOrders) {
    
  // Most returned reasons
  const reasonCounts = {};
  returnRequests.forEach(req => {
    reasonCounts[req.reason] = (reasonCounts[req.reason] || 0) + 1;
  });
  const mostReturnedReasons = Object.entries(reasonCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([reason, count]) => ({ 
      reason, 
      count,
      percentage: ((count / returnRequests.length) * 100).toFixed(1)
    }));

  // Most returned customers
  const customerCounts = {};
  returnRequests.forEach(req => {
    customerCounts[req.customerId] = (customerCounts[req.customerId] || 0) + 1;
  });
  const mostReturnedCustomers = Object.entries(customerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([customerId, count]) => ({ 
      customerId, 
      count,
      percentage: ((count / returnRequests.length) * 100).toFixed(1)
    }));

  // Refund percentage
  const refundedCount = returnRequests.filter(req => req.refunded).length;
  const refundPercentage = returnRequests.length > 0 
    ? (refundedCount / returnRequests.length) * 100 
    : 0;

  // Total refunds
  const totalRefunds = returnRequests
    .filter(req => req.refunded && req.refundAmount)
    .reduce((sum, req) => sum + req.refundAmount, 0);

  // Most returned products (based on order IDs)
  const orderCounts = {};
  returnRequests.forEach(req => {
    orderCounts[req.orderId] = (orderCounts[req.orderId] || 0) + 1;
  });
  const mostReturnedOrders = Object.entries(orderCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([orderId, count]) => ({ 
      orderId, 
      count,
      percentage: ((count / returnRequests.length) * 100).toFixed(1)
    }));

  // Most returned categories (based on product types from database)
  const categoryCounts = {};
  returnRequests.forEach(req => {
    // Try to find matching product to get category
    const matchingProduct = products.find(p => req.orderId.includes(p.shopifyId));
    if (matchingProduct) {
      // Extract category from product type or use a default
      const category = matchingProduct.productType || 'Other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    } else {
      categoryCounts['Unknown'] = (categoryCounts['Unknown'] || 0) + 1;
    }
  });
  
  const mostReturnedCategories = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([category, count]) => ({ 
      category, 
      count,
      percentage: ((count / returnRequests.length) * 100).toFixed(1)
    }));

  // Overall return rate
  const overallReturnRate = totalOrders > 0 
    ? ((returnRequests.length / totalOrders) * 100).toFixed(1)
    : 0;

  return {
    mostReturnedReasons,
    mostReturnedCustomers,
    mostReturnedOrders,
    mostReturnedCategories,
    refundPercentage,
    totalRefunds,
    refundedCount,
    totalRequests: returnRequests.length,
    overallReturnRate,
  };
}

export default function AnalyticsPage() {
  const { analytics, totalOrders, totalProducts, returnRequests, error } = useLoaderData();

  if (error) {
    return (
      <Page title="Store Analytics">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Text color="critical">Error loading analytics: {error}</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Store Analytics">
      <Layout>
        <Layout.Section>
          <Button url="/app" variant="plain">
            ← Back to Dashboard
          </Button>
        </Layout.Section>
        {/* Overview Cards */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text variant="headingLg">Overview</Text>
            <InlineStack gap="400" wrap={false}>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="headingMd">Total Returns</Text>
                  <Text variant="headingLg" color="critical">{returnRequests}</Text>
                  <Text variant="bodySm" color="subdued">
                    {analytics.overallReturnRate}% return rate
                  </Text>
                </BlockStack>
              </Card>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="headingMd">Refund Rate</Text>
                  <Text variant="headingLg" color="success">{analytics.refundPercentage.toFixed(1)}%</Text>
                  <Text variant="bodySm" color="subdued">
                    {analytics.refundedCount} of {analytics.totalRequests} returns refunded
                  </Text>
                </BlockStack>
              </Card>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="headingMd">Total Refunds</Text>
                  <Text variant="headingLg" color="warning">${analytics.totalRefunds.toFixed(2)}</Text>
                  <Text variant="bodySm" color="subdued">
                    Total amount refunded
                  </Text>
                </BlockStack>
              </Card>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="headingMd">Total Orders</Text>
                  <Text variant="headingLg">{totalOrders}</Text>
                  <Text variant="bodySm" color="subdued">
                    Orders in system
                  </Text>
                </BlockStack>
              </Card>
            </InlineStack>
          </BlockStack>
        </Layout.Section>

        {/* Most Returned Reasons */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd">Most Returned Reasons</Text>
              {analytics.mostReturnedReasons.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Reason", "Count", "Percentage"]}
                  rows={analytics.mostReturnedReasons.map(item => [
                    item.reason,
                    item.count,
                    `${item.percentage}%`
                  ])}
                />
              ) : (
                <Text>No return reasons data available.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Most Returned Categories */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd">Most Returned Categories</Text>
              {analytics.mostReturnedCategories.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Category", "Returns", "Return Rate"]}
                  rows={analytics.mostReturnedCategories.map(item => [
                    item.category,
                    item.count,
                    `${item.percentage}%`
                  ])}
                />
              ) : (
                <Text>No category data available.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Most Returned Customers */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd">Most Returned Customers</Text>
              {analytics.mostReturnedCustomers.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Customer ID", "Returns", "Percentage"]}
                  rows={analytics.mostReturnedCustomers.map(item => [
                    item.customerId,
                    item.count,
                    `${item.percentage}%`
                  ])}
                />
              ) : (
                <Text>No customer return data available.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Most Returned Orders */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd">Most Returned Orders</Text>
              {analytics.mostReturnedOrders.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Order ID", "Return Count", "Percentage"]}
                  rows={analytics.mostReturnedOrders.map(item => [
                    item.orderId,
                    item.count,
                    `${item.percentage}%`
                  ])}
                />
              ) : (
                <Text>No order return data available.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Refund Progress */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd">Refund Progress</Text>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd">Refund Rate</Text>
                  <Text variant="bodyMd">{analytics.refundPercentage.toFixed(1)}%</Text>
                </InlineStack>
                <ProgressBar 
                  progress={analytics.refundPercentage} 
                  size="small"
                />
                <Text variant="bodySm" color="subdued">
                  {analytics.refundedCount} of {analytics.totalRequests} returns have been refunded
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 