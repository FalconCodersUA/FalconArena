import React, { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

const App: React.FC = () => {
    useEffect(() => {
        document.body.style.backgroundColor = "transparent";
        return () => {
            document.body.style.backgroundColor = "";
        };
    }, []);

    return <RouterProvider router={router} />;
};

export default App;
