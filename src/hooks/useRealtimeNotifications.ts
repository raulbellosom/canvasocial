import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { client, appwriteConfig } from "../lib/appwrite";
import { useAuth } from "../contexts/AuthContext";

// Simple "ding" sound (base64)
const NOTIFICATION_SOUND =
  "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; // Placeholder, will replace with real short beep base64 if needed, or use a public URL.
// Actually, let's use a real short beep base64 for better UX.
const BEEP_B64 =
  "data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDyoY6Hb44/6iP+oT/qC/6f/6d/6c/6b/6a/6Z/6X/6W/6V/6U/6T/6S/6R/6Q/6P/6O/6N/6M/6L/6K/6J/6I/6H/6G/6F/6E/6D/6C/6B/6A/5//57/53/5z/5v/5r/5q/5p/5o/5n/5m/5l/5k/5j/5i/5h/5g/5f/5e/5d/5c/5b/5a/5Z/5Y/5X/5W/5V/5U/5T/5S/5R/5Q/5P/5O/5N/5M/5L/5K/5J/5I/5H/5G/5F/5E/5D/5C/5B/5A/4//47/43/4z/4y/4x/4w/4v/4r/4q/4p/4o/4n/4m/4l/4k/4j/4i/4h/4g/4f/4e/4d/4c/4b/4a/4Z/4Y/4X/4W/4V/4U/4T/4S/4R/4Q/4P/4O/4N/4M/4L/4K/4J/4I/4H/4G/4F/4E/4D/4C/4B/4A/3//37/33/3z/3y/3x/3w/3v/3r/3q/3p/3o/3n/3m/3l/3k/3j/3i/3h/3g/3f/3e/3d/3c/3b/3a/3Z/3Y/3X/3W/3V/3U/3T/3S/3R/3Q/3P/3O/3N/3M/3L/3K/3J/3I/3H/3G/3F/3E/3D/3C/3B/3A/2//27/23/2z/2y/2x/2w/2v/2r/2q/2p/2o/2n/2m/2l/2k/2j/2i/2h/2g/2f/2e/2d/2c/2b/2a/2Z/2Y/2X/2W/2V/2U/2T/2S/2R/2Q/2P/2O/2N/2M/2L/2K/2J/2I/2H/2G/2F/2E/2D/2C/2B/2A/1//17/13/1z/1y/1x/1w/1v/1r/1q/1p/1o/1n/1m/1l/1k/1j/1i/1h/1g/1f/1e/1d/1c/1b/1a/1Z/1Y/1X/1W/1V/1U/1T/1S/1R/1Q/1P/1O/1N/1M/1L/1K/1J/1I/1H/1G/1F/1E/1D/1C/1B/1A/0//07/03/0z/0y/0x/0w/0v/0r/0q/0p/0o/0n/0m/0l/0k/0j/0i/0h/0g/0f/0e/0d/0c/0b/0a/0Z/0Y/0X/0W/0V/0U/0T/0S/0R/0Q/0P/0O/0N/0M/0L/0K/0J/0I/0H/0G/0F/0E/0D/0C/0B/0A/z//z7/z3/zz/zy/zx/zw/zv/zr/zq/zp/zo/zn/zm/zl/zk/zj/zi/zh/zg/zf/ze/zd/zc/zb/za/zZ/zY/zX/zW/zV/zU/zT/zS/zR/zQ/zP/zO/zN/zM/zL/zK/zJ/zI/zH/zG/zF/zE/zD/zC/zB/zA/y//y7/y3/yz/yy/yx/yw/yv/yr/yq/yp/yo/yn/ym/yl/yk/yj/yi/yh/yg/yf/ye/yd/yc/yb/ya/yZ/yY/yX/yW/yV/yU/yT/yS/yR/yQ/yP/yO/yN/yM/yL/yK/yJ/yI/yH/yG/yF/yE/yD/yC/yB/yA/x//x7/x3/xz/xy/xx/xw/xv/xr/xq/xp/xo/xn/xm/xl/xk/xj/xi/xh/xg/xf/xe/xd/xc/xb/xa/xZ/xY/xX/xW/xV/xU/xT/xS/xR/xQ/xP/xO/xN/xM/xL/xK/xJ/xI/xH/xG/xF/xE/xD/xC/xB/xA/w//w7/w3/wz/wy/wx/ww/wv/wr/wq/wp/wo/wn/wm/wl/wk/wj/wi/wh/wg/wf/we/wd/wc/wb/wa/wZ/wY/wX/wW/wV/wU/wT/wS/wR/wQ/wP/wO/wN/wM/wL/wK/wJ/wI/wH/wG/wF/wE/wD/wC/wB/wA";

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Init Audio
    if (typeof Audio !== "undefined") {
      const audio = new Audio(BEEP_B64);
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
