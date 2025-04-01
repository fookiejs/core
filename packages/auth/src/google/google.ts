export async function verifyGoogleAccessToken(
	token: string,
): Promise<{ sub: string; email: string; name: string; picture: string; iss: string } | null> {
	try {
		const response = await fetch(
			`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`,
		)

		if (!response.ok) {
			return null
		}

		const data = await response.json()

		if (!data.sub && !data.user_id) {
			return null
		}

		const userId = data.sub || data.user_id
		let userData = {
			iss: "https://accounts.google.com",
			sub: userId,
			email: data.email || "",
			name: data.name || "",
			picture: data.picture || "",
		}

		if (data.email) {
			try {
				const userInfoResponse = await fetch(
					`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`,
				)

				if (userInfoResponse.ok) {
					const userInfo = await userInfoResponse.json()
					userData = {
						iss: "https://accounts.google.com",
						sub: userId,
						email: userInfo.email || data.email || "",
						name: userInfo.name || data.name || "",
						picture: userInfo.picture || data.picture || "",
					}
				}
			} catch (error) {
				console.error("User info fetch error:", error)
			}
		}

		return userData
	} catch (error) {
		console.error("Access token validation error:", error)
		return null
	}
}
