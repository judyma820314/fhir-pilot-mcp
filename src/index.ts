import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { registerOnboardingTools } from './tools/onboarding';
import { registerContentTools } from './tools/content';
import { registerResolverTools } from './tools/resolver';

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'fhir-pilot',
    version: '0.1.0',
  });

  registerOnboardingTools(server);
  registerContentTools(server);
  registerResolverTools(server);

  return server;
}

const app = express();
app.use(express.json());

// MCP endpoint — new server instance per request (stateless prototype)
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on('close', () => server.close().catch(() => {}));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fhir-pilot', version: '0.1.0' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`FHIR Pilot MCP server running on port ${PORT}`);
  console.log(`  MCP endpoint : http://localhost:${PORT}/mcp`);
  console.log(`  Health check : http://localhost:${PORT}/health`);
});
