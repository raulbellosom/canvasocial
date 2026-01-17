import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { client, appwriteConfig } from "../lib/appwrite";
import { useAuth } from "../contexts/AuthContext";

// Reliable notification sound URL
const NOTIFICATION_SOUND_URL =
  "https://raw.githubusercontent.com/shunjizhan/react-notifications-component/master/src/components/audio/notification.mp3";

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Init Audio
    if (typeof Audio !== "undefined") {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.volume = 0.5;
      audioRef.current = audio;
    }

    if (!user) return;

    const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.notifications}.documents`;

    const unsubscribe = client.subscribe(channel, (response) => {
      // Check if it's a create event
      if (
        response.events.includes("databases.*.collections.*.documents.*.create")
      ) {
        const payload = response.payload as any;

        // Check if notification is for current user
        if (payload.user_id === user.$id) {
          // Play Sound
          audioRef.current?.play().catch(() => {
            // Ignore auto-play errors
          });

          // Invalidate Queries
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, qc]);
}
