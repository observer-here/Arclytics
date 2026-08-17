import { useEffect, useState } from "react";
import { cachedUser, refreshMe, subscribeAuth, type AuthUser } from "@/libs/auth";
import { loadWatchlist } from "@/libs/watchlist";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);

  useEffect(() => {
    const off = subscribeAuth(() => {
      setUser(cachedUser());
      void loadWatchlist();
    });
    void refreshMe().then(() => loadWatchlist());
    return off;
  }, []);

  return user;
}
