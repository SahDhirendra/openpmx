"""
OpenPMX Version Management
"""

VERSION = "1.1.0"
GITHUB_REPO = "SahDhirendra/openpmx"

def get_version():
    return VERSION

async def check_for_updates():
    """Check GitHub Releases for newer version"""
    import httpx
    from packaging import version
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                latest = data["tag_name"].lstrip("v")
                current = VERSION
                
                is_newer = version.parse(latest) > version.parse(current)
                
                return {
                    "current_version": current,
                    "latest_version": latest,
                    "update_available": is_newer,
                    "release_url": data["html_url"],
                    "release_notes": data.get("body", "")[:200]
                }
    except Exception as e:
        return {
            "current_version": VERSION,
            "latest_version": VERSION,
            "update_available": False,
            "error": str(e)
        }