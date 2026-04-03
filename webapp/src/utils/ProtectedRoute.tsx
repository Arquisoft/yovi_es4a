import { Navigate } from "react-router-dom";
import { getUserSession } from "./session";

type ProtectedRouteProps = {
    children: JSX.Element;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const session = getUserSession();

    if (!session)
        return <Navigate to="/" replace />;

    return children;
}