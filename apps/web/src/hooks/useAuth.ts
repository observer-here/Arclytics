import { useEffect, useState } from "react";
import { cachedUser, refreshMe, subscribeAuth, type AuthUser } from "@/libs/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);

  useEffect(() => {
    const off = subscribeAuth(() => setUser(cachedUser()));
    void refreshMe();
    return off;
  }, []);

  return user;
}
