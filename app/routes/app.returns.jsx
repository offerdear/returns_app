import { Page, Layout, Card, Button } from "@shopify/polaris";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
// import { createReturnRequest, getReturnRequests } from "../db.server";

// Loader: fetch all return requests
export async function loader() {
  const { getReturnRequests } = await import("../db.server");
  const requests = await getReturnRequests();
  return json({ requests });
}

// Action: handle form submission
export async function action({ request }) {
  const { createReturnRequest } = await import("../db.server");
  const formData = await request.formData();
  const customerId = formData.get("customerId");
  const orderId = formData.get("orderId");
  const reason = formData.get("reason");
  // For simplicity, skipping file upload for receipts here

  await createReturnRequest({
    customerId,
    orderId,
    reason,
    receipts: [], // Add receipt logic if needed
  });

  return redirect("/app/returns");
}

export default function Returns() {
  const { requests } = useLoaderData();

  return (
    <Page title="Returns Management">
      {/* <Layout>
        <Layout.Section>
          <Card>
            <p>Welcome to your returns dashboard!</p>
            <Button primary>Process Return</Button>
          </Card>
        </Layout.Section>
      </Layout> */}

      <div>
        <h1>Return Requests</h1>
        <Form method="post">
          <input name="customerId" placeholder="Customer ID" required />
          <input name="orderId" placeholder="Order ID" required />
          <input name="reason" placeholder="Reason" required />
          {/* Add file input for receipts if needed */}
          <button type="submit">Submit Return Request</button>
        </Form>

        <h2>All Requests</h2>
        <ul>
          {requests.map(req => (
            <li key={req.id}>
              {req.customerId} - {req.orderId} - {req.reason} - {req.status}
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
