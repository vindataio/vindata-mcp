import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		// this.server.registerTool("add", { inputSchema: { a: z.number(), b: z.number() }}, async ({ a, b }) => ({
		// 	content: [{ type: "text", text: String(a + b) }],
		// }));

		// Calculator tool with multiple operations
		// this.server.registerTool(
		// 	"calculate",
		// 	{
		// 		inputSchema: {
		// 			operation: z.enum(["add", "subtract", "multiply", "divide"]),
		// 			a: z.number(),
		// 			b: z.number(),
		// 		},
		// 	},
		// 	async ({ operation, a, b }) => {
		// 		let result: number;
		// 		switch (operation) {
		// 			case "add":
		// 				result = a + b;
		// 				break;
		// 			case "subtract":
		// 				result = a - b;
		// 				break;
		// 			case "multiply":
		// 				result = a * b;
		// 				break;
		// 			case "divide":
		// 				if (b === 0)
		// 					return {
		// 						content: [
		// 							{
		// 								type: "text",
		// 								text: "Error: Cannot divide by zero",
		// 							},
		// 						],
		// 					};
		// 				result = a / b;
		// 				break;
		// 		}
		// 		return { content: [{ type: "text", text: String(result) }] };
		// 	},
		// );

		this.server.tool(
			"decode_vin",
			"Decode a VIN using the VINdata decoder API.",
			{
				vin: z.string().length(17).describe("A valid 17-character VIN."),
			},
			async ({ vin }) => {
				try {
					const response = await fetch(this.env.VINDATA_DECODER_URL, {
						method: "POST",
						headers: {
							"content-type": "application/json",
							"x-api-key": this.env.VINDATA_API_KEY,
						},
						body: JSON.stringify({ vin }),
					});

					if (!response.ok) {
						const errorText = await response.text();
						return {
							content: [
								{
									type: "text",
									text: `Decoder API error (${response.status}): ${errorText}`,
								},
							],
						};
					}

					const data: DecoderResponse = await response.json();

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(data, null, 2),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Failed to decode VIN: ${
									error instanceof Error ? error.message : "Unknown error"
								}`,
							},
						],
					};
				}
			},
		);

		this.server.tool(
			"find_comparables",
			"Find comparable vehicle listings from the market_listings table.",
			{
				vin: z.string().length(17).optional().describe("Optional VIN to match against."),
				year: z.number().int().optional().describe("Optional vehicle year."),
				trim: z.string().optional().describe("Optional trim."),
				mileage: z.number().int().optional().describe("Optional mileage."),
				limit: z.number().int().min(1).max(20).default(10),
			},
			async ({ vin, year, trim, mileage, limit }) => {
				try {
					const params = new URLSearchParams();
					params.set("select", "*");
					params.set("limit", String(limit));

					if (vin) {
						params.append("vin", `eq.${vin}`);
					}
					if (year !== undefined) {
						params.append("year", `eq.${year}`);
					}
					if (trim) {
						params.append("trim", `ilike.*${trim}*`);
					}
					if (mileage !== undefined) {
						params.append("mileage", `eq.${mileage}`);
					}

					const url = `${this.env.SUPABASE_URL}/rest/v1/market_listings?${params.toString()}`;

					const response = await fetch(url, {
						method: "GET",
						headers: {
							apikey: this.env.SUPABASE_ANON_KEY,
							Authorization: `Bearer ${this.env.SUPABASE_ANON_KEY}`,
							Accept: "application/json",
						},
					});

					if (!response.ok) {
						const errorText = await response.text();
						return {
							content: [
								{
									type: "text",
									text: `Supabase error (${response.status}): ${errorText}`,
								},
							],
						};
					}

					const data: SupabaseResponse = await response.json();

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(data, null, 2),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Failed to find comparables: ${
									error instanceof Error ? error.message : "Unknown error"
								}`,
							},
						],
					};
				}
			},
		);

		this.server.tool(
			"lookup_option_codes",
			"Look up vehicle option codes from the option_codes table.",
			{
				code: z.string().optional().describe("Option code to search for."),
				vin: z.string().length(17).optional().describe("Optional VIN."),
				year: z.number().int().optional().describe("Optional year."),
				keyword: z.string().optional().describe("Optional keyword to search in description."),
				limit: z.number().int().min(1).max(50).default(20),
			},
			async ({ code, vin, year, keyword, limit }) => {
				try {
					const params = new URLSearchParams();
					params.set("select", "*");
					params.set("limit", String(limit));

					if (code) {
						params.append("code", `ilike.*${code}*`);
					}
					if (vin) {
						params.append("vin", `eq.${vin}`);
					}
					if (year !== undefined) {
						params.append("year", `eq.${year}`);
					}
					if (keyword) {
						params.append("description", `ilike.*${keyword}*`);
					}

					const url = `${this.env.SUPABASE_URL}/rest/v1/option_codes?${params.toString()}`;

					const response = await fetch(url, {
						method: "GET",
						headers: {
							apikey: this.env.SUPABASE_ANON_KEY,
							Authorization: `Bearer ${this.env.SUPABASE_ANON_KEY}`,
							Accept: "application/json",
						},
					});

					if (!response.ok) {
						const errorText = await response.text();
						return {
							content: [
								{
									type: "text",
									text: `Supabase error (${response.status}): ${errorText}`,
								},
							],
						};
					}

					const data: SupabaseResponse = await response.json();

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(data, null, 2),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Failed to look up option codes: ${
									error instanceof Error ? error.message : "Unknown error"
								}`,
							},
						],
					};
				}
			},
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
