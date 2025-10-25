<script lang="ts" generics="T">
    import { onMount, tick } from "svelte";
    import type { Snippet } from "svelte";
    import Deferred from "../deferred";

    let {
        id = "",
        items,
        item,
        header,
        empty,
        height = "100%",
        itemHeight = undefined,
        headerHeight = 0,
        start = $bindable(0),
        end = $bindable(0),
        viewport = $bindable<HTMLDivElement>(),
        onRefresh = undefined,
        thumbnail = false,
    }: {
        id?: string;
        items: T[];
        item: Snippet<[T]>;
        header: Snippet;
        empty: Snippet;
        height?: string;
        itemHeight?: number | undefined;
        headerHeight?: number;
        start: number;
        end: number;
        viewport: HTMLDivElement | undefined;
        onRefresh?: ((nodes: HTMLElement[]) => void) | undefined;
        thumbnail?: boolean;
    } = $props();

    let height_map: number[] = [];
    let rows: HTMLElement[];
    let contents: any;
    let average_height: number;
    let scrollPromise: Deferred<boolean> | null;

    let viewport_height = $state(0);
    let mounted = $state(false);
    let top = $state(0);
    let bottom = $state(0);

    const visible = $derived(
        items.slice(start, end).map((data, i) => {
            return { index: i + start, data };
        }),
    );

    // whenever `items` changes, invalidate the current heightmap
    $effect(() => {
        if (mounted) refresh(items, viewport_height, itemHeight);
    });

    async function refresh(items: T[], viewport_height: number, itemHeight: number | undefined) {
        const isStartOverflow = items.length < start;

        if (isStartOverflow) {
            scrollToIndex(items.length ? items.length - 1 : 0, { behavior: "auto" });
        }

        const { scrollTop } = viewport;

        await tick(); // wait until the DOM is up to date

        let content_height = top - scrollTop;
        let i = start;

        while (content_height < viewport_height && i < items.length) {
            let row = rows[i - start];

            if (!row) {
                end = i + 1;
                await tick(); // render the newly visible row
                row = rows[i - start];
            }

            const row_height = (height_map[i] = itemHeight || row.offsetHeight);
            content_height += row_height;
            i += 1;
        }

        end = i;

        const remaining = items.length - end;
        average_height = (top + content_height) / end;

        bottom = remaining * average_height;
        height_map.length = items.length;

        if (rows.length && onRefresh) {
            onRefresh(rows);
        }
    }

    async function handle_scroll() {
        const { scrollTop } = viewport;

        for (let v = 0; v < rows.length; v += 1) {
            height_map[start + v] = itemHeight || rows[v].offsetHeight;
        }

        let i = 0;
        let y = 0;

        if (items.length) {
            while (i < items.length) {
                const row_height = height_map[i] || average_height;
                if (y + row_height > scrollTop) {
                    start = i;
                    top = y;

                    break;
                }

                y += row_height;
                i += 1;
            }
        } else {
            // reset if items is empty
            start = 0;
            top = 0;
        }

        while (i < items.length) {
            y += height_map[i] || average_height;
            i += 1;

            if (y > scrollTop + viewport_height) break;
        }

        end = i;

        const remaining = items.length - end;
        average_height = y / end;

        while (i < items.length) height_map[i++] = average_height;
        bottom = remaining * average_height;

        if (scrollPromise) {
            scrollPromise.resolve(true);
            scrollPromise = null;
        }

        // TODO if we overestimated the space these
        // rows would occupy we may need to add some
        // more. maybe we can just call handle_scroll again?
    }

    export async function scrollToIndex(index: number, opts: ScrollToOptions, alignBottom?: boolean) {
        const { scrollTop } = viewport;
        const itemsDelta = alignBottom ? Math.max(1, index - start) : index - start;
        const _itemHeight = itemHeight || average_height;
        const _distance = itemsDelta * _itemHeight;
        const distance = Math.abs(_distance) > headerHeight ? _distance - headerHeight : _distance;

        opts = {
            left: 0,
            top: scrollTop + distance,
            behavior: "smooth",
            ...opts,
        };
        // Should calculate and update padding-top before scroll
        await handle_scroll();
        viewport.scrollTo(opts);
        // Should await scrollend
        scrollPromise = new Deferred();
        return await scrollPromise.promise;
    }

    // trigger initial refresh
    onMount(() => {
        rows = contents.getElementsByTagName("svelte-virtual-list-row");
        mounted = true;
    });
</script>

<svelte-virtual-list-viewport {id} data-v-list bind:this={viewport} bind:offsetHeight={viewport_height} onscroll={handle_scroll} style="height: {height};">
    <svelte-virtual-list-contents data-v-list bind:this={contents} style="padding-top: {top}px; padding-bottom: {bottom}px;" class:thumbnail>
        {#if header.length}
            {@render header()}
        {:else}
            {@render empty?.()}
        {/if}
        {#if visible.length}
            {#each visible as row (row.index)}
                <svelte-virtual-list-row class:thumbnail-row={thumbnail}>
                    {@render item(row.data)}
                </svelte-virtual-list-row>
            {/each}
        {:else}
            {@render empty?.()}
        {/if}
    </svelte-virtual-list-contents>
</svelte-virtual-list-viewport>

<style>
    svelte-virtual-list-viewport {
        position: relative;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        display: block;
    }

    svelte-virtual-list-contents,
    svelte-virtual-list-row {
        display: block;
        width: fit-content;
    }

    svelte-virtual-list-row {
        overflow: hidden;
    }

    .thumbnail {
        display: flex;
        margin: 10px 0px;
        row-gap: 10px;
        flex-wrap: wrap;
    }

    .thumbnail-row {
        display: flex;
        flex-direction: row;
    }
</style>
