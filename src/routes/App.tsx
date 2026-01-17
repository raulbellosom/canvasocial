import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../ui/AppShell";
import { LoginPage } from "../views/auth/LoginPage";
import { RegisterPage } from "../views/auth/RegisterPage";
import { WorkspacesPage } from "../views/workspaces/WorkspacesPage";
import { CanvasListPage } from "../views/canvases/CanvasListPage";
import { CanvasEditorPage } from "../views/editor/CanvasEditorPage";
import { NotificationsPage } from "../views/notifications/NotificationsPage";
import { useAuth } from "../contexts/AuthContext";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="text-sm text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={user ? <AppShell /> : <Navigate to="/login" replace />}
      >
        <Route index element={<WorkspacesPage />} />
        <Route
          path="workspaces/:workspaceId/canvases"
          element={<CanvasListPage />}
        />
        <Route path="canvases/:canvasId" element={<CanvasEditorPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={user ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
