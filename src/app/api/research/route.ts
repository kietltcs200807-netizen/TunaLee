import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function fetchWebResults(query: string) {
  const bingKey = process.env.BING_SEARCH_API_KEY;
  if (!bingKey) return null;

  const apiUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=4&mkt=en-US`;
  const res = await fetch(apiUrl, { headers: { "Ocp-Apim-Subscription-Key": bingKey }});
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.webPages?.value?.length) return null;

  return data.webPages.value.slice(0, 3).map((item: any) => ({
    title: item.name,
    snippet: item.snippet,
    url: item.url,
  }));
}

export async function POST(req: NextRequest) {
  try {
    let GoogleGenerativeAI;
    try {
      ({ GoogleGenerativeAI } = await import("@google/generative-ai"));
    } catch (importError) {
      console.error("Failed to import GoogleGenerativeAI:", importError);
      return NextResponse.json({ error: "Failed to load AI SDK" }, { status: 500 });
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_actual_gemini_api_key_here") {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    let genAI;
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (genAIError) {
      console.error("Failed to create GoogleGenerativeAI:", genAIError);
      return NextResponse.json({ error: "Failed to initialize AI client" }, { status: 500 });
    }
    const { query, history } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const webResults = await fetchWebResults(query);

    const sourceText = webResults
      ? webResults.map((res: { title: string; snippet: string; url: string }, i: number) => `${i + 1}. ${res.title}\n${res.snippet}\n${res.url}`).join("\n\n")
      : "";

    let model;
    try {
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
    } catch (modelError) {
      console.error("Failed to create Gemini model:", modelError);
      return NextResponse.json({ error: "Failed to initialize AI model" }, { status: 500 });
    }

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    let systemPrompt = `You are an expert AI Research Assistant helping university students with their group assignments. Provide detailed summaries from real sources, cite key points, and suggest how to apply the results to the user's assignment. Avoid generic placeholder links. `;

    if (sourceText) {
      systemPrompt += "Use the following real search results as your basis when applicable:\n" + sourceText;
    } else {
      systemPrompt += "You were not able to fetch web results, so use your internal knowledge and indicate that the answers are based on general domain knowledge.";
    }

    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      }
    });

    const result = await chat.sendMessage(query);
    const text = result.response.text();

    return NextResponse.json({ response: text, sources: webResults || [] });
  } catch (error: any) {
    console.error("Research assistant error:", error);
    return NextResponse.json({ error: error.message || "Failed to process research request" }, { status: 500 });
  }
}
