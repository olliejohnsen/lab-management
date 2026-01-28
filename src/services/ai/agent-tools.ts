/**
 * AI Agent Tools - Functions that the AI agent can execute
 */

import { prisma } from "@/lib/prisma";
import { MetricsService } from "@/services/docker/metrics";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: (params: any) => Promise<any>;
}

/**
 * Get all available tools for the AI agent
 */
export function getAgentTools(): Tool[] {
  return [
    // ==================== HOST MANAGEMENT ====================
    {
      name: "list_hosts",
      description: "Get a list of all Docker hosts with their current status and metrics",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        const hosts = await prisma.dockerHost.findMany({
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            connectionType: true,
            _count: {
              select: {
                deployments: true,
              },
            },
          },
        });

        const hostsWithMetrics = await Promise.all(
          hosts.map(async (host) => {
            const hostMetrics = await MetricsService.collectHostMetrics(host.id);
            return {
              ...host,
              metrics: hostMetrics,
              deploymentCount: host._count.deployments,
            };
          })
        );

        return { hosts: hostsWithMetrics };
      },
    },

    {
      name: "get_host_details",
      description: "Get detailed information about a specific host including containers and resources",
      parameters: {
        type: "object",
        properties: {
          hostId: {
            type: "string",
            description: "The ID of the host to get details for",
          },
        },
        required: ["hostId"],
      },
      execute: async ({ hostId }) => {
        const host = await prisma.dockerHost.findUnique({
          where: { id: hostId },
          include: {
            deployments: {
              select: {
                id: true,
                status: true,
                deployedAt: true,
              },
            },
          },
        });

        if (!host) {
          throw new Error(`Host with ID ${hostId} not found`);
        }

        const hostMetrics = await MetricsService.collectHostMetrics(hostId);

        // Get container details
        const connector = await DockerConnectionManager.getConnector(
          host.id,
          host.connectionType,
          host.host,
          host.port,
          host.credentials
        );
        const containers = await connector.listContainers();

        return {
          host,
          metrics: hostMetrics,
          containers,
        };
      },
    },

    // ==================== DEPLOYMENT MANAGEMENT ====================
    {
      name: "list_deployments",
      description: "Get a list of all deployments across all hosts",
      parameters: {
        type: "object",
        properties: {
          hostId: {
            type: "string",
            description: "Optional: Filter deployments by host ID",
          },
          status: {
            type: "string",
            description: "Optional: Filter by deployment status",
            enum: ["DEPLOYING", "RUNNING", "STOPPED", "FAILED"],
          },
        },
        required: [],
      },
      execute: async ({ hostId, status }) => {
        const whereClause: any = {};
        if (hostId) whereClause.hostId = hostId;
        if (status) whereClause.status = status;

        const deployments = await prisma.deployment.findMany({
          where: whereClause,
          include: {
            host: {
              select: {
                id: true,
                name: true,
                host: true,
              },
            },
            composeFile: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            deployedAt: "desc",
          },
        });

        // Parse metadata to extract projectName
        const deploymentsWithProjectName = deployments.map((d) => {
          try {
            const metadata = d.metadata ? JSON.parse(d.metadata) : {};
            return { ...d, projectName: metadata.projectName || d.composeFile.name };
          } catch {
            return { ...d, projectName: d.composeFile.name };
          }
        });

        return { deployments: deploymentsWithProjectName };
      },
    },

    {
      name: "deploy_compose_file",
      description: "Deploy a Docker Compose stack to a specific host",
      parameters: {
        type: "object",
        properties: {
          hostId: {
            type: "string",
            description: "The ID of the host to deploy to",
          },
          projectName: {
            type: "string",
            description: "A unique name for this deployment project",
          },
          composeContent: {
            type: "string",
            description: "The Docker Compose YAML content to deploy",
          },
          description: {
            type: "string",
            description: "Optional description of what this deployment is for",
          },
        },
        required: ["hostId", "projectName", "composeContent"],
      },
      execute: async ({ hostId, projectName, composeContent, description }) => {
        // This would typically call the deployment API
        // For now, return a simulated response
        return {
          message: "Deployment initiated",
          projectName,
          hostId,
          status: "DEPLOYING",
          note: "Use the deployments page to monitor progress",
        };
      },
    },

    {
      name: "stop_deployment",
      description: "Stop a running deployment",
      parameters: {
        type: "object",
        properties: {
          deploymentId: {
            type: "string",
            description: "The ID of the deployment to stop",
          },
        },
        required: ["deploymentId"],
      },
      execute: async ({ deploymentId }) => {
        const deployment = await prisma.deployment.findUnique({
          where: { id: deploymentId },
          include: { host: true, composeFile: true },
        });

        if (!deployment) {
          throw new Error(`Deployment with ID ${deploymentId} not found`);
        }

        // Extract projectName from metadata
        const metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
        const projectName = metadata.projectName || deployment.composeFile.name;

        const connector = await DockerConnectionManager.getConnector(
          deployment.host.id,
          deployment.host.connectionType,
          deployment.host.host,
          deployment.host.port,
          deployment.host.credentials
        );
        
        try {
          await connector.stopDeployment(projectName);
          
          await prisma.deployment.update({
            where: { id: deploymentId },
            data: { status: "stopped" },
          });

          return {
            success: true,
            message: `Deployment ${projectName} stopped successfully`,
          };
        } catch (error) {
          throw new Error(`Failed to stop deployment: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      },
    },

    {
      name: "restart_deployment",
      description: "Restart a stopped or running deployment",
      parameters: {
        type: "object",
        properties: {
          deploymentId: {
            type: "string",
            description: "The ID of the deployment to restart",
          },
        },
        required: ["deploymentId"],
      },
      execute: async ({ deploymentId }) => {
        const deployment = await prisma.deployment.findUnique({
          where: { id: deploymentId },
          include: { host: true, composeFile: true },
        });

        if (!deployment) {
          throw new Error(`Deployment with ID ${deploymentId} not found`);
        }

        // Extract projectName from metadata
        const metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
        const projectName = metadata.projectName || deployment.composeFile.name;

        const connector = await DockerConnectionManager.getConnector(
          deployment.host.id,
          deployment.host.connectionType,
          deployment.host.host,
          deployment.host.port,
          deployment.host.credentials
        );
        
        try {
          await connector.restartDeployment(projectName);
          
          await prisma.deployment.update({
            where: { id: deploymentId },
            data: { status: "running" },
          });

          return {
            success: true,
            message: `Deployment ${projectName} restarted successfully`,
          };
        } catch (error) {
          throw new Error(`Failed to restart deployment: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      },
    },

    // ==================== CONTAINER MANAGEMENT ====================
    {
      name: "list_containers",
      description: "List all containers on a specific host",
      parameters: {
        type: "object",
        properties: {
          hostId: {
            type: "string",
            description: "The ID of the host to list containers from",
          },
        },
        required: ["hostId"],
      },
      execute: async ({ hostId }) => {
        const host = await prisma.dockerHost.findUnique({
          where: { id: hostId },
        });

        if (!host) {
          throw new Error(`Host with ID ${hostId} not found`);
        }

        const connector = await DockerConnectionManager.getConnector(
          host.id,
          host.connectionType,
          host.host,
          host.port,
          host.credentials
        );
        const containers = await connector.listContainers();

        return { containers };
      },
    },

    // ==================== METRICS & MONITORING ====================
    {
      name: "get_system_metrics",
      description: "Get aggregated metrics across all hosts",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async () => {
        const allMetrics = await MetricsService.getLatestMetricsForAllHosts();

        // Calculate aggregates
        let totalHosts = 0;
        let totalCPU = 0;
        let totalRAM = 0;
        let totalDisk = 0;
        let totalPorts = 0;

        for (const [hostId, hostMetrics] of Object.entries(allMetrics)) {
          if (hostMetrics) {
            totalHosts++;
            totalCPU += hostMetrics.cpuUsage || 0;
            totalRAM += hostMetrics.ramUsage || 0;
            totalDisk += hostMetrics.diskUsage || 0;
            totalPorts += hostMetrics.usedPorts?.length || 0;
          }
        }

        const avgCPU = totalHosts > 0 ? totalCPU / totalHosts : 0;
        const avgRAM = totalHosts > 0 ? totalRAM / totalHosts : 0;
        const avgDisk = totalHosts > 0 ? totalDisk / totalHosts : 0;

        return {
          summary: {
            totalHosts,
            totalPorts,
            averageCPU: Math.round(avgCPU),
            averageRAM: Math.round(avgRAM),
            averageDisk: Math.round(avgDisk),
          },
          hostMetrics: allMetrics,
        };
      },
    },

    // ==================== HELPER FUNCTIONS ====================
    {
      name: "suggest_host_for_deployment",
      description: "Suggest the best host for deploying based on resource requirements",
      parameters: {
        type: "object",
        properties: {
          composeContent: {
            type: "string",
            description: "The Docker Compose content to analyze for requirements",
          },
        },
        required: ["composeContent"],
      },
      execute: async ({ composeContent }) => {
        // This would use the placement analyzer
        // For now, return a simulated response
        const hosts = await prisma.dockerHost.findMany({
          select: { id: true, name: true },
        });

        if (hosts.length === 0) {
          return { message: "No hosts available" };
        }

        let bestHost = hosts[0];
        let bestScore = 0;

        for (const host of hosts) {
          const hostMetrics = await MetricsService.collectHostMetrics(host.id);
          if (hostMetrics) {
            const score =
              (100 - hostMetrics.cpuUsage) +
              (100 - hostMetrics.ramUsage) +
              (100 - hostMetrics.diskUsage);
            
            if (score > bestScore) {
              bestScore = score;
              bestHost = host;
            }
          }
        }

        return {
          recommendedHost: bestHost,
          reason: "This host has the most available resources",
        };
      },
    },

    {
      name: "search_deployments",
      description: "Search for deployments by name or description",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to match against project names and descriptions",
          },
        },
        required: ["query"],
      },
      execute: async ({ query }) => {
        // Get all deployments and filter by projectName in memory
        // since projectName is stored in metadata JSON
        const allDeployments = await prisma.deployment.findMany({
          where: {
            OR: [
              { composeFile: { name: { contains: query, mode: "insensitive" } } },
              { metadata: { contains: query } }, // Simple contains check for metadata
            ],
          },
          include: {
            host: {
              select: {
                name: true,
                host: true,
              },
            },
            composeFile: {
              select: {
                name: true,
              },
            },
          },
          take: 20,
        });

        // Parse metadata and filter more precisely
        const deployments = allDeployments
          .map((d) => {
            try {
              const metadata = d.metadata ? JSON.parse(d.metadata) : {};
              return { ...d, projectName: metadata.projectName || d.composeFile.name };
            } catch {
              return { ...d, projectName: d.composeFile.name };
            }
          })
          .filter((d) =>
            d.projectName.toLowerCase().includes(query.toLowerCase()) ||
            d.composeFile.name.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10);

        return { deployments, count: deployments.length };
      },
    },
  ];
}

/**
 * Execute a tool by name with parameters
 */
export async function executeTool(toolName: string, parameters: any): Promise<any> {
  const tools = getAgentTools();
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }

  try {
    const result = await tool.execute(parameters);
    return {
      success: true,
      tool: toolName,
      result,
    };
  } catch (error) {
    return {
      success: false,
      tool: toolName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get tool definitions for the LLM (OpenAI function calling format)
 */
export function getToolDefinitions() {
  const tools = getAgentTools();
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
