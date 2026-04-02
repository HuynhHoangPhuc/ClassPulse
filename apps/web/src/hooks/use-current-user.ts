import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@clerk/clerk-react"
import { fetchApi } from "@/lib/fetch-api"

interface CurrentUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: "teacher" | "student" | "parent"
  createdAt: number
  updatedAt: number
}

/** Fetches the authenticated user's profile from /api/users/me */
export function useCurrentUser() {
  const { getToken } = useAuth()

  return useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const token = await getToken()
      return fetchApi("/api/users/me", {}, token) as Promise<CurrentUser>
    },
    staleTime: 1000 * 60 * 5, // 5 minutes — role doesn't change often
  })
}
