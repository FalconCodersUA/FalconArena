import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ghost , Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
            <Card className="relative w-full max-w-sm overflow-hidden border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg transition-all duration-500 sm:hover:-translate-y-2 sm:hover:shadow-2xl">
                <div className="pointer-events-none absolute inset-0 opacity-60 sm:opacity-0 sm:hover:opacity-100 transition duration-500">
                    <div className="absolute -inset-1 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500 dark:from-gray-700 dark:via-gray-500 dark:to-gray-300 blur-2xl opacity-20" />
                </div>

                <CardContent className="relative flex flex-col items-center justify-center py-12 sm:py-16 space-y-6">
                    <Ghost  className="w-10 h-10 text-black dark:text-white" />

                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-black via-gray-700 to-gray-500 dark:from-white dark:via-gray-300 dark:to-gray-500 bg-clip-text text-transparent text-center">
                        404 – Not Found
                    </h1>

                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        The page you are looking for does not exist.
                    </p>

                    <Button
                        onClick={() => navigate("/")}
                        className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 flex items-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Go back home
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
