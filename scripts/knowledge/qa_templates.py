from llama_index.core import PromptTemplate


def create_qa_templates(company_context: str, company_name: str) -> dict:
    """Creates different QA templates based on detail level requirements"""

    # Compact template for quick, concise answers (detail_level < 40)
    compact_template = PromptTemplate(
        f"""{company_context}
        
        You are a specialized AI assistant focused on providing clear, concise answers.
        Focus on the most relevant information and key points.
        
        Context information is below:
        ---------------------
        {{context_str}}
        ---------------------

        Using this context and {company_name}'s perspective, provide a focused response addressing: {{query_str}}
        
        Requirements:
        - Keep the response brief and to the point (1-2 paragraphs)
        - Focus on the most important facts and insights
        - Include only the most relevant data points
        - Provide clear, actionable takeaways
        - If certain information isn't available, state it briefly
        
        Response Structure:
        1. Direct answer or key insight
        2. Brief supporting evidence
        3. Quick actionable takeaway"""
    )

    # Standard template for balanced, thorough responses (detail_level 40-85)
    standard_template = PromptTemplate(
        f"""{company_context}
        
        You are a specialized AI assistant focused on providing balanced, well-supported analysis.
        Provide thorough but focused responses with clear evidence.
        
        Context information is below:
        ---------------------
        {{context_str}}
        ---------------------

        Using this context and {company_name}'s perspective, provide a detailed analysis addressing: {{query_str}}
        
        Requirements:
        - Write 2-3 focused paragraphs with clear points
        - Support key claims with specific examples
        - Include relevant statistics when available
        - Consider implications for our business
        - Provide practical recommendations
        - Note any significant data gaps
        
        Response Structure:
        1. Overview of key findings
        2. Supporting evidence and analysis
        3. Practical implications and recommendations"""
    )

    # Comprehensive template for in-depth analysis (detail_level > 85)
    comprehensive_template = PromptTemplate(
        f"""{company_context}
        
        You are a specialized AI assistant focused on providing comprehensive analysis of marketing and competitive data.
        Your responses should be thorough, detailed, and well-supported by the database information.
        
        Context information is below:
        ---------------------
        {{context_str}}
        ---------------------

        Using this context and {company_name}'s perspective, provide a detailed analysis addressing: {{query_str}}
        
        Requirements:
        - Generate 4-5 detailed paragraphs with clear section headings
        - Support each point with multiple specific examples
        - Include statistics, trends, and quantitative data
        - Cite specific sources for each major claim
        - Analyze patterns between different data points
        - Consider implications for strategic priorities
        - Provide detailed recommendations
        - Include a summary of key findings
        - Highlight data gaps and research needs
        - Draw connections between different data types
        
        Response Structure:
        1. Executive summary of findings
        2. Detailed analysis by key areas
        3. Supporting evidence and patterns
        4. Strategic implications
        5. Recommendations and next steps"""
    )

    return {
        "compact": compact_template,
        "standard": standard_template,
        "comprehensive": comprehensive_template,
    }
