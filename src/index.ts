import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";


// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
	login: string;
	name: string;
	email: string;
	accessToken: string;
};


type Env = {
	VINDATA_DECODER_URL: string;
	VINDATA_API_KEY: string;
	SUPABASE_URL: string;
	SUPABASE_ANON_KEY: string;
  };

type DecoderResponse = unknown;
type SupabaseResponse = unknown;

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "VINdata MCP",
		version: "1.0.0",
	});

	async handleAuthorize(request: Request, env: Env) {
		const params = new URL(request.url).searchParams;
		const redirect = `https://vindata.io/oauth/authorize?` +
		  `client_id=mcp&` +
		  `redirect_uri=${encodeURIComponent(params.get('redirect_uri') ?? '')}&` +
		  `state=${params.get('state') ?? ''}`;
		return Response.redirect(redirect, 302);
	  }
	  
	  async handleCallback(code: string, env: Env) {
		const res = await fetch('https://vindata.io/oauth/token', {
		  method: 'POST',
		  headers: { 'Content-Type': 'application/json' },
		  body: JSON.stringify({ code, grant_type: 'authorization_code' })
		});
		const { access_token } = await res.json();
		return access_token;
	  }

	async init() {
	const supabase = createClient(
		this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY
		);
	
		

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

export default MyMCP.serve("/mcp");

// export default new OAuthProvider({
// 	apiHandler: MyMCP.serve("/mcp"),
// 	apiRoute: "/mcp",
// 	authorizeEndpoint: "/authorize",
// 	clientRegistrationEndpoint: "/register",
// 	defaultHandler: GitHubHandler as any,
// 	tokenEndpoint: "/token",
// });