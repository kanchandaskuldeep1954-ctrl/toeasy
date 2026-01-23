import axios from 'axios';
import { GroqService } from './groq.service.js';

export class ScraperService {
    static async scrapeUrl(url: string, topic: string, fields: string[], count: number): Promise<any[]> {
        try {
            console.log(`Scraping URL: ${url} for topic: ${topic}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                },
                timeout: 15000
            });

            const html = response.data;

            // Clean HTML to save tokens
            const text = html
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .substring(0, 10000); // Limit to 10k chars for Groq context

            const prompt = `You are an expert Data Extraction Agent. I have scraped a webpage and I need you to extract structured data from it.
      
      URL: ${url}
      Topic Scope: ${topic}
      Target Fields: ${fields.join(', ')}
      Target Row Count: ${count}
      
      WEBPAGE CONTENT SNIPPET:
      ${text}
      
      TASK:
      Extract as many real records as possible (up to ${count}) that match the topic. 
      If the webpage doesn't contain enough real data, complement it with HIGHLY REALISTIC data that follows the same patterns seen in the text.
      
      RETURN ONLY a valid JSON array of objects. No markdown, no pre-amble.`;

            const groqResponse = await GroqService.callGroq(prompt, 3000);

            let data = [];
            try {
                let jsonStr = groqResponse.trim();
                if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
                else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
                data = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Scraper JSON parse failed", e);
                // Fallback to synthetic if extraction fails completely
                return GroqService.generateSyntheticData(topic, fields, count);
            }

            return Array.isArray(data) ? data.slice(0, count) : [data];
        } catch (error) {
            console.error("Scrape error:", error);
            // Fallback to synthetic
            return GroqService.generateSyntheticData(topic, fields, count);
        }
    }
}
