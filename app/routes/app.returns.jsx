import { Page, Layout, Card, Button } from "@shopify/polaris";

export default function Returns() {
  return (
    <Page title="Returns Management">
      <Layout>
        <Layout.Section>
          <Card>
            <p>Welcome to your returns dashboard!</p>
            <Button primary>Process Return</Button>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}