import { List } from "./components/List";
import { Pagination } from "./components/Pagination";
import { Search } from "./components/Search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <h1 className="whitespace-nowrap text-lg font-bold">🤗 Hugging Face Mirror</h1>

            <p className="font-normal text-gray-400">
                A simple mirror for the most popular models.
            </p>

            <Search className="my-4" />

            <List className="flex-grow" />

            <Pagination />
        </QueryClientProvider>
    );
}

export function Test() {}
