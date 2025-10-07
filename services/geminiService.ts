// Fix: Replaced deprecated 'GoogleGenerativeAI' with 'GoogleGenAI' as per SDK guidelines.
import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import type { Message, ReasoningMode, ConversationInsights, NegativeFeedbackCategory } from '../types';

// Ensure the API key is available. In a real app, you'd have more robust error handling.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

// Fix: Replaced deprecated 'GoogleGenerativeAI' with 'GoogleGenAI' as per SDK guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const DEFAULT_SYSTEM_INSTRUCTION = 'You are FAV AI, a friendly and helpful assistant. Your tone should be warm, approachable, and conversational. Prioritize being clear and accurate, but feel free to add a touch of wit. Your primary goal is to assist the user in a positive and engaging way.';
export const CREATIVE_WRITER_INSTRUCTION = 'You are a master creative writer. Your expertise lies in storytelling, poetry, and evocative prose. Your tone is artistic and imaginative. You should help users craft compelling narratives, write beautiful descriptions, and explore the nuances of language. Your primary goal is to inspire creativity and assist with all forms of artistic writing.';
export const TECHNICAL_EXPERT_INSTRUCTION = 'You are a technical expert and programmer. Your communication style is precise, logical, and direct. You provide accurate, efficient, and well-documented solutions to technical problems, code-related queries, and data analysis tasks. You must prioritize correctness and clarity above all else, avoiding conversational fluff. Assume you are speaking to a fellow technical professional.';


export const createChatSession = (history?: Message[], reasoningMode: ReasoningMode = 'normal', systemInstruction?: string): Chat => {
  const chatParams: {
    model: string;
    config: {
      systemInstruction: string;
      thinkingConfig?: { thinkingBudget: number };
    };
    history?: { role: 'user' | 'model'; parts: { text: string }[] }[];
  } = {
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
    },
  };
  
  if (reasoningMode === 'fast') {
    chatParams.config.thinkingConfig = { thinkingBudget: 0 };
  }

  if (history && history.length > 0) {
    const validHistory = history.filter(msg => msg.content.trim() !== '');
    chatParams.history = validHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
    }));
  }

  const chat = ai.chats.create(chatParams);
  return chat;
};

export const generateGroundedContent = async (prompt: string): Promise<{ text: string; sources: { uri: string; title: string }[] }> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const text = response.text;
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    let sources: { uri: string; title: string }[] = [];

    if (groundingMetadata?.groundingChunks) {
      sources = groundingMetadata.groundingChunks
        .filter(chunk => chunk.web && chunk.web.uri)
        .map(chunk => ({
          uri: chunk.web.uri,
          title: chunk.web.title || chunk.web.uri,
        }));
    }

    return { text, sources };

  } catch (error) {
    console.error("Error generating grounded content:", error);
    throw new Error("Failed to get a grounded response. The web may be unreachable.");
  }
};

export const generateAvatar = async (prompt: string): Promise<string> => {
  try {
    const enhancementResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Expand this into a detailed image prompt for a profile avatar: "${prompt}"`,
      config: {
        systemInstruction: "You are a creative prompt engineer for an AI image generator. Your task is to take a user's brief idea and expand it into a single, detailed, descriptive sentence for a futuristic, high-quality avatar. Do not add any conversational text or explanations, just output the enhanced prompt.",
        thinkingConfig: { thinkingBudget: 0 },
      }
    });

    const enhancedPrompt = enhancementResponse.text.trim();

    const imageResponse = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: enhancedPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '1:1',
      },
    });

    if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
      const base64ImageBytes: string = imageResponse.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${base64ImageBytes}`;
    }
    throw new Error("No image was generated.");
  } catch (error) {
    console.error("Error generating avatar:", error);
    throw new Error("Failed to generate AI avatar. Please try again.");
  }
};

export const generateTitle = async (userMessage: string, modelResponse: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following conversation, create a concise title (4 words maximum).\n\nUser: "${userMessage}"\n\nAI: "${modelResponse}"`,
      config: {
        systemInstruction: "You are a title generator. Your only job is to create a short, relevant title for a conversation. Do not add any conversational text, explanations, or quotation marks. Just output the title.",
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 15,
      },
    });
    
    let title = response.text.trim().replace(/["']/g, '');
    if (!title) {
        // Fallback to a truncated version of the user's message if title generation returns empty
        return userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
    }
    return title;

  } catch (error) {
    console.error("Error generating title:", error);
    // Fallback to a truncated version of the user's message if title generation fails
    return userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
  }
};

export const generateConversationInsights = async (messages: Message[]): Promise<ConversationInsights> => {
  // === 1. Local Feedback Analysis ===
  const feedbackSummary: ConversationInsights['feedbackSummary'] = {
    good: 0,
    bad: 0,
    categoryCounts: { 'Inaccurate': 0, 'Unhelpful': 0, 'Offensive': 0, 'Other': 0 },
    commonThemes: [],
    comments: [],
  };

  for (const msg of messages) {
    if (msg.feedback) {
      if (msg.feedback.rating === 'good') {
        feedbackSummary.good++;
      } else if (msg.feedback.rating === 'bad') {
        feedbackSummary.bad++;
        if (msg.feedback.categories) {
          for (const category of msg.feedback.categories) {
            feedbackSummary.categoryCounts[category]++;
          }
        }
        if (msg.feedback.comment) {
          feedbackSummary.comments.push({
            messageContent: msg.content,
            feedbackComment: msg.feedback.comment,
            categories: msg.feedback.categories || [],
          });
        }
      }
    }
  }

  // === 2. AI-Powered General Insights & Feedback Theme Analysis ===
  const relevantMessages = messages.filter(msg => msg.content.trim() && msg.id !== 'initial');
  if (relevantMessages.length < 1) {
    return {
      summary: 'This conversation is just getting started.',
      actionItems: [],
      sentiment: 'Neutral',
      keyTopics: [],
      feedbackSummary, // Return locally analyzed feedback even for short conversations
    };
  }

  const conversationHistory = relevantMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

  try {
    // Perform general insight generation and feedback theme analysis in parallel
    const insightPromises = [];

    // Promise for general insights
    insightPromises.push(ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following conversation. Provide a concise summary, a list of action items, the overall sentiment (Positive, Negative, Neutral, or Mixed), and a list of up to 5 key topics discussed.\n\n---\n\n${conversationHistory}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A concise, neutral summary of the conversation's main points." },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of tasks, questions, or follow-ups that were explicitly mentioned or strongly implied." },
            sentiment: { type: Type.STRING, description: "The overall sentiment of the conversation. Must be one of: Positive, Negative, Neutral, Mixed." },
            keyTopics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of up to 5 main topics or keywords from the conversation." }
          }
        },
      },
    }));

    // Promise for feedback themes if there are comments
    if (feedbackSummary.comments.length > 0) {
      const feedbackContext = feedbackSummary.comments.map((c, i) => 
        `Feedback #${i+1}:\n- AI Message: "${c.messageContent}"\n- User's Reason(s): ${c.categories.join(', ') || 'N/A'}\n- User's Comment: "${c.feedbackComment}"`
      ).join('\n\n');
      
      insightPromises.push(ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on the following user feedback, identify up to 3 common themes or recurring problems. A theme is a high-level summary of an issue. For example, "AI is too verbose" or "Factual inaccuracies about history".\n\n---\n\n${feedbackContext}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              commonThemes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of up to 3 common themes identified from the feedback." }
            }
          }
        },
      }));
    }

    const [generalInsightsResponse, feedbackThemesResponse] = await Promise.all(insightPromises);

    const generalInsights = JSON.parse(generalInsightsResponse.text);
    if (feedbackThemesResponse) {
      const feedbackThemes = JSON.parse(feedbackThemesResponse.text);
      feedbackSummary.commonThemes = feedbackThemes.commonThemes || [];
    }

    return {
      ...generalInsights,
      feedbackSummary,
    };

  } catch (error) {
    console.error("Error generating conversation insights:", error);
    // Even if AI fails, return the locally analyzed feedback
    return {
      summary: 'AI analysis failed.',
      actionItems: [],
      sentiment: 'Neutral',
      keyTopics: [],
      feedbackSummary,
    }
  }
};

export const refineContent = async (instruction: string, content: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${instruction}:\n\n---\n\n"${content}"`,
      config: {
        systemInstruction: "You are a text editor. Your task is to modify the given text based on the user's instruction. Output only the modified text, without any additional commentary, conversational text, or quotation marks.",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error refining content:", error);
    throw new Error("Failed to refine the response. Please try again.");
  }
};

export const embedContent = async (text: string): Promise<number[]> => {
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      content: text,
    });
    return response.embedding.values;
  } catch (error) {
    console.error("Error embedding content:", error);
    throw new Error("Failed to create embedding for the provided text.");
  }
};

// Utility function to calculate cosine similarity between two vectors
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (vecA.length !== vecB.length) {
        return 0;
    }
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += vecA[i] * vecA[i];
        magnitudeB += vecB[i] * vecB[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }
    return dotProduct / (magnitudeA * magnitudeB);
};