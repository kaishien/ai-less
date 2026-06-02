# pip install langfuse langchain-openai
# docker run -d -p 3000:3000 langfuse/langfuse
# env: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST=http://localhost:3000
import os
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langfuse.callback import CallbackHandler

handler = CallbackHandler()

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
])
chain = prompt | llm | StrOutputParser()

result = chain.invoke(
    {"input": "Объясни RAG в двух предложениях."},
    config={"callbacks": [handler]},
)
print(result)
print("Trace visible at http://localhost:3000")
