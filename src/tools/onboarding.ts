import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';

export function registerOnboardingTools(server: McpServer): void {
  // --- create_hdsf_instance -------------------------------------------
  server.tool(
    'create_hdsf_instance',
    `Creates a new SAP Health Data Services for FHIR (HDSF) instance in a BTP subaccount.
Use this when a partner wants to provision a new FHIR server to develop, deploy, and test content.
Returns the instance ID, FHIR base URL, and a prompt asking whether to create a service key.`,
    {
      subaccount: z.string().describe('BTP subaccount name (e.g. mySubacc1)'),
      namespace: z.string().describe('FHIR namespace for the instance (e.g. test123)'),
      bind_ems: z.boolean().optional().describe('Bind an EMS (Event Mesh Service) instance. Default false.'),
      ems_credentials: z.string().optional().describe('EMS credentials JSON, required when bind_ems is true'),
    },
    async ({ subaccount, namespace, bind_ems = false }) => {
      // TODO: POST https://api.cf.eu10-004.hana.ondemand.com/v3/service_instances
      //   service plan: hdsf-standard, parameters: { namespace }
      //   bind EMS via service binding if bind_ems is true

      const instanceId = `hdsf-${namespace}-${Date.now()}`;
      const fhirUrl = `https://${namespace}.cfapps.eu10.hana.ondemand.com/fhir/R4`;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            instance_id: instanceId,
            subaccount,
            namespace,
            fhir_base_url: fhirUrl,
            ems_bound: bind_ems,
            status: 'created',
            message: `HDSF instance created in subaccount '${subaccount}' with namespace '${namespace}'. You can access it at: ${fhirUrl}`,
            next_step: 'Would you like to create a service key for this instance?',
            _mock: true,
          }, null, 2),
        }],
      };
    },
  );

  // --- create_service_key -------------------------------------------
  server.tool(
    'create_service_key',
    `Creates a service key (credential binding) for an existing HDSF instance.
The key contains the OAuth client ID, client secret, and token URL needed to call the FHIR API.
Use this after creating an HDSF instance, or when credentials need rotation.`,
    {
      instance_id: z.string().describe('HDSF instance ID returned by create_hdsf_instance'),
      key_name: z.string().describe('Name for the service key (e.g. mykey1)'),
    },
    async ({ instance_id, key_name }) => {
      // TODO: POST https://api.cf.eu10-004.hana.ondemand.com/v3/service_credential_bindings
      //   type: key, name: key_name, relationships.service_instance.data.guid: instance_id

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            key_name,
            instance_id,
            credentials: {
              clientid: `sb-${instance_id}!t12345`,
              clientsecret: '[REDACTED — real secret provided in production]',
              url: 'https://ec-demo.authentication.eu10.hana.ondemand.com/oauth/token',
              uri: `https://hdsf-${instance_id}.cfapps.eu10.hana.ondemand.com`,
              identityzone: 'ec-demo',
            },
            message: `Service key '${key_name}' created for instance '${instance_id}'.`,
            _mock: true,
          }, null, 2),
        }],
      };
    },
  );

  // --- get_fhir_info -------------------------------------------
  server.tool(
    'get_fhir_info',
    `Answers questions about FHIR standards, SAP Health Data Services for FHIR (HDSF), and SAP BTP integration.
Returns explanations and links to official SAP documentation and HL7 FHIR specs.
Use this for onboarding questions, resource type queries, or profile guidance.`,
    {
      question: z.string().describe('The FHIR or HDSF question to answer'),
      topic: z.enum(['fhir-basics', 'fhir-profiles', 'hdsf-setup', 'hdsf-api', 'hl7-resources', 'sap-integration'])
        .optional()
        .describe('Topic area for targeted answers'),
    },
    async ({ question, topic }) => {
      // TODO: Replace with RAG over SAP Help Portal + HL7 FHIR specification docs

      const docs: Record<string, string[]> = {
        'fhir-basics': [
          'https://hl7.org/fhir/R4/',
          'https://community.sap.com/topics/health-data-services-for-fhir',
        ],
        'fhir-profiles': [
          'https://hl7.org/fhir/R4/profiling.html',
          'https://simplifier.net/',
        ],
        'hdsf-setup': [
          'https://help.sap.com/docs/SAP_HEALTH_DATA_SERVICES_FOR_FHIR',
          'https://discovery-center.cloud.sap/serviceCatalog/health-data-services-for-fhir',
        ],
        'hdsf-api': [
          'https://help.sap.com/docs/SAP_HEALTH_DATA_SERVICES_FOR_FHIR/api',
        ],
        'hl7-resources': [
          'https://hl7.org/fhir/R4/resourcelist.html',
        ],
        'sap-integration': [
          'https://help.sap.com/docs/integration-suite',
          'https://api.sap.com/package/SAPIntegrationSuite',
        ],
      };

      const links = topic ? docs[topic] : Object.values(docs).flat().slice(0, 5);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            question,
            topic: topic ?? 'general',
            answer: '[MOCK] In production, this queries SAP documentation via RAG to give a specific, accurate answer.',
            documentation: links,
            _mock: true,
          }, null, 2),
        }],
      };
    },
  );
}
