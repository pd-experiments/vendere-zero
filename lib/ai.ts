import { Groq } from "groq-sdk";
import OpenAI from "openai";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export { groq, openai };
