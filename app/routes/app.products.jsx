// app/routes/app.products.jsx
import { json } from "@remix-run/node";
// import { authenticate } from "../shopify.server";
// import { createOrUpdateProduct } from "../db.server";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Thumbnail } from "@shopify/polaris";
import prisma from "../db.server";


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
          {products.length === 0 ? (
            <Text>No products found.</Text>
          ) : (
            products.map((prod) => (
              <Card key={prod.id} sectioned>
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
                    <Text as="p">{prod.description}</Text>
                    <Text as="p" color="subdued">
                      Price: {prod.price ? `$${prod.price}` : "N/A"}
                    </Text>
                  </Layout.Section>
                </Layout>
              </Card>
            ))
          )}
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
