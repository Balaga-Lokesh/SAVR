from serpapi import GoogleSearch

def fetch_product_image(query):
    """
    Fetch the first product image from Google Images using SerpAPI.
    Returns an image URL or a placeholder if nothing found.
    """
    try:
        search = GoogleSearch({
            "q": query,
            "tbm": "isch",   # image search
            "ijn": "0",
            "api_key": "YOUR_SERPAPI_KEY"   # 🔑 replace with your SerpAPI key
        })

        results = search.get_dict()
        images_results = results.get("images_results", [])
        if images_results:
            return images_results[0].get("original") or images_results[0].get("thumbnail")

    except Exception as e:
        print("Error fetching image:", e)

    # fallback placeholder
    return "https://via.placeholder.com/150"
