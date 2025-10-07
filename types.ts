export type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  feedback?: Feedback;
  isError?: boolean;
};

export type FeedbackRating = 'good' | 'bad';
export type NegativeFeedbackCategory = 'Inaccurate' | 'Unhelpful' | 'Offensive' | 'Other';

export interface Feedback {
  rating: FeedbackRating;
  categories?: NegativeFeedbackCategory[];
  comment?: string;
}

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
};

export enum AuthMode {
  Login = 'login',
  SignUp = 'signup',
}

export type ReasoningMode = 'normal' | 'fast';
export type GroundingMode = 'nexus' | 'disabled' | 'vector';

export interface User {
  username: string;
  email: string;
  password?: string; // Should not be stored long-term in client, but needed for mock auth
  displayName: string;
  avatar: string | null; // Base64 string or null
  reasoningMode: ReasoningMode;
  groundingMode: GroundingMode;
  systemInstruction?: string;
}

export interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
}

export type Sentiment = 'Positive' | 'Negative' | 'Neutral' | 'Mixed';

export interface ConversationInsights {
  summary: string;
  actionItems: string[];
  sentiment: Sentiment;
  keyTopics: string[];
  feedbackSummary: {
    good: number;
    bad: number;
    categoryCounts: Record<NegativeFeedbackCategory, number>;
    commonThemes: string[];
    comments: { 
      messageContent: string; 
      feedbackComment: string;
      categories: NegativeFeedbackCategory[];
    }[];
  };
}