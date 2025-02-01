import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../utils/style";
import { JobModelsResponse } from "../../routes/api/jobs";
import { useDebounce } from "../hooks/useDebounce";
import { Card } from "./Card";
import { LastJobState, PaginationState } from "./Pagination";
import { SearchState } from "./Search";

type Props = {
    className?: string;
};

export function List({ className }: Props) {
    const queryClient = useQueryClient();
    const { data: searchState } = useQuery<SearchState>({
        queryKey: ["searchState"],
        enabled: false,
    });
    const debouncedSearchState = useDebounce(searchState, 500);
    const { data: paginationState } = useQuery<PaginationState>({
        queryKey: ["paginationState"],
        enabled: false,
    });
    const { data: lastJobState } = useQuery<LastJobState>({
        queryKey: ["lastJob"],
        enabled: false,
    });
    const { data: modelsResponse, isLoading } = useQuery<JobModelsResponse>({
        queryKey: [
            "models",
            lastJobState?._id,
            paginationState?.page,
            debouncedSearchState?.search,
            debouncedSearchState?.minSize,
            debouncedSearchState?.maxSize,
        ],
        queryFn: async () => {
            if (!lastJobState || !paginationState) {
                return { data: [], pagination: { page: 1, total: 0, pages: 1, limit: 0 } };
            }

            let extraParams = "";
            if (debouncedSearchState && debouncedSearchState?.search.trim() !== "") {
                extraParams += `&search=${debouncedSearchState.search}`;
            }
            if (debouncedSearchState?.minSize) {
                extraParams += `&sizeGte=${debouncedSearchState.minSize}`;
            }
            if (debouncedSearchState?.maxSize) {
                extraParams += `&sizeLte=${debouncedSearchState.maxSize}`;
            }

            const response = await fetch(
                `/api/jobs/${lastJobState._id}/models?limit=10&sort=-trendingScore&page=${paginationState.page}${extraParams}`,
                {
                    method: "GET",
                }
            );
            return await response.json();
        },
        staleTime: 10000,
        enabled: !!lastJobState && !!paginationState,
    });

    useEffect(
        function updateMaxPage() {
            if (modelsResponse && "pagination" in modelsResponse) {
                queryClient.setQueryData(["paginationState"], {
                    page: modelsResponse.pagination.page,
                    maxPage: modelsResponse.pagination.pages,
                });
            }
        },
        [modelsResponse]
    );

    return (
        <div className={cn(className, "flex flex-col gap-2 w-full")}>
            {isLoading ? (
                <div className="self-center text-s text-gray-500 m-auto">Loading top models...</div>
            ) : null}

            {modelsResponse && "error" in modelsResponse ? (
                <div className="self-center text-s text-gray-500 m-auto">
                    {modelsResponse.message || modelsResponse.error}
                </div>
            ) : null}

            {modelsResponse && "data" in modelsResponse && modelsResponse.data.length === 0 ? (
                <div className="self-center text-s text-gray-500 m-auto">No results</div>
            ) : null}

            {modelsResponse && "data" in modelsResponse
                ? modelsResponse.data.map((model) => <Card key={model.id} model={model} />)
                : null}
        </div>
    );
}
