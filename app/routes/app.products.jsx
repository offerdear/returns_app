// app/routes/app.products.jsx
import { json } from "@remix-run/node";
// import { authenticate } from "../shopify.server";
// import { createOrUpdateProduct } from "../db.server";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Thumbnail, Button, Box } from "@shopify/polaris";
import prisma from "../db.server";
import styles from "../styles/products.module.css";


export const loader = async ({ request }) => {
  // const { admin } = await authenticate.admin(request);
  const products = await prisma.product.findMany();
  return json({ products });

};

export default function ProductsPage() {
  const { products } = useLoaderData();
  console.log(products);

  return (
    <Page title="All Products">
      <Layout>
        <Layout.Section>
          <Button url="/app" variant="plain">
            ← Back to Dashboard
          </Button>
          <Box paddingBlockEnd="400" />
          {products.length === 0 ? (
            <Text>No products found.</Text>
          ) : (
            <div className={styles.grid}>
              {products.map((prod) => (
                <Card key={prod.id} sectioned className={styles.tallCard}>
                  <Layout>
                    <Layout.Section oneThird>
                      {prod.imageUrl ? (
                        <Thumbnail source={prod.imageUrl} alt={prod.title} size="large" />
                      ) : (
                        <Thumbnail size="large" />
                      )}
                    </Layout.Section>
                    <Layout.Section>
                      <Text variant="headingMd">{prod.title}</Text>
                      <div dangerouslySetInnerHTML={{ __html: prod.description }} />
                      <Text as="p" color="subdued">
                        Price: {prod.price ? `$${prod.price}` : "N/A"}
                      </Text>
                    </Layout.Section>
                  </Layout>
                </Card>
              ))}
            </div>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
