"""Optional live-provider sanity check. Only synthetic public-style text is sent."""
import asyncio
from main import embed, EmbedInput
from matching import cosine


async def main():
    result = await embed(EmbedInput(texts=[
        "Python backend internship. Required: Python, FastAPI and PostgreSQL. Responsibilities: build and test APIs.",
        "Office cafeteria. Today's lunch menu includes rice, vegetables and dessert. Catering reservations are open.",
        "Python backend internship required technical skills and API development responsibilities",
    ]))
    vectors = result["vectors"]
    relevant, unrelated = cosine(vectors[2], vectors[0]), cosine(vectors[2], vectors[1])
    if relevant <= unrelated:
        raise RuntimeError("Synthetic retrieval relevance check failed")
    print(f"PASS live embedding sanity: model={result['model']}, dimensions={result['dimensions']}, relevant={relevant:.3f}, unrelated={unrelated:.3f}")
    print("One synthetic example only; this does not establish production retrieval quality.")


if __name__ == "__main__":
    asyncio.run(main())
