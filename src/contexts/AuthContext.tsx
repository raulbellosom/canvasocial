import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { account, databases, appwriteConfig } from "../lib/appwrite";
import { Models, ID, Query } from "appwrite";
import { UserProfile } from "../lib/types";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null,
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const init = async () => {
    try {
      const loggedInUser = await account.get();
      setUser(loggedInUser);
      // Fetch profile
      try {
        const profiles = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.profiles,
          [
            // Query by user_auth_id
            Query.equal("user_auth_id", loggedInUser.$id),
            Query.limit(1),
          ],
        );
        if (profiles.documents.length > 0) {
          setProfile(profiles.documents[0] as unknown as UserProfile);
        } else {
          console.warn("Profile not found for user", loggedInUser.$id);
        }
      } catch (e) {
        console.error("Error fetching profile", e);
      }
    } catch (error) {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const login = async (email: string, password: string) => {
    await account.createEmailPasswordSession(email, password);
    await init();
  };

  const register = async (email: string, password: string, name: string) => {
    const userId = ID.unique();
    await account.create(userId, email, password, name);

    // Auto login after register
    await login(email, password);

    // Create Profile
    try {
      const currentUser = await account.get();
      // Create Profile with unique ID, linking to auth ID
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.profiles,
        ID.unique(), // Unique Document ID
        {
          user_auth_id: currentUser.$id, // Relational Field
          email: email,
          name: name,
          enabled: true,
        },
      );
      await init();
    } catch (error) {
      console.error("Error creating profile", error);
    }
  };

  const logout = async () => {
    await account.deleteSession("current");
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
