# @limetech/n8n-nodes-lime-crm

This is an n8n community node. It lets you use Lime CRM in your n8n workflows.

[Lime CRM](https://www.lime-technologies.com/en/products/lime-crm/) is a customer relationship management platform from Lime Technologies. This package lets you read and write CRM data (lime objects), work with files and users, and trigger workflows on CRM events.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)
[Development](#development)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `@limetech/n8n-nodes-lime-crm`.

## Operations

### Lime CRM

- **Metadata**: get all limetypes, get a single limetype, get file metadata.
- **Data**: get many objects (with filtering, ordering and pagination), get, create, update and delete a single object, get a file, and bulk create, update or upsert many objects through the bulk-import API (requires the `limepkg-mbeku-bulk-import` package in the Lime CRM solution).
- **Admin**: get many users, get a single user.

### Lime CRM Trigger

Starts a workflow when an object of a chosen limetype is created, updated or deleted. The trigger registers a webhook subscription in Lime CRM, verifies the HMAC signature of every delivery with the webhook secret configured in the credential.

## Credentials

Create a **Lime CRM API** credential with:

| Field      | Description                                                                           |
| ---------- | ------------------------------------------------------------------------------------- |
| Server URL | The URL of your Lime CRM instance, e.g. `https://instance.lime-crm.com/instance-name` |
| API Key    | API key generated in Lime CRM (available from Lime Admin)                             |

Requests are authenticated with the `X-API-Key` header, which n8n adds automatically. The credential is verified against the `/api/v1/` endpoint of your instance when you save it.

To use the trigger, also set the optional **Webhook Secret** in the credential; Lime CRM signs deliveries with it. Use a strong value, e.g. generated with `openssl rand -hex 32`.

## Compatibility

Requires n8n with `n8n-workflow` 2.9 or later. Node.js 24 is used for local development.

## Resources

- [Lime CRM node reference](https://platform.docs.lime-crm.com/en/latest/workflows-and-integrations/node-reference/)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Lime CRM](https://www.lime-technologies.com/en/products/lime-crm/)

## Development

```bash
npm ci
npm run build   # compile to dist/
npm test        # jest unit tests
npm run lint    # n8n community node lint rules
npm run knip    # dead code check
```

## License

[MIT](LICENSE)
