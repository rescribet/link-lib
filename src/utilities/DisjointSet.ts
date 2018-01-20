/**
 * DisjointSet
 * Module port from https://github.com/mljs/disjoint-set/
 */

/**
 * @class DisjointSet
 */
export class DisjointSet<T> {
    private nodes: Map<T, DisjointSetNode<T>>;

    constructor() {
        this.nodes = new Map();
    }

    /**
     * Adds an element as a new set
     * @param {*} value
     * @return {DisjointSetNode} Object holding the element
     */
    public add(value: T): DisjointSetNode<T> {
        let node = this.nodes.get(value);
        if (!node) {
            node = new DisjointSetNode(value);
            this.nodes.set(value, node);
        }

        return node;
    }

    /**
     * Merges the sets that contain x and y
     * @param {DisjointSetNode} x
     * @param {DisjointSetNode} y
     */
    public union(x: DisjointSetNode<T>, y: DisjointSetNode<T>): void {
        const rootX = this.find(x);
        const rootY = this.find(y);
        if (rootX === rootY) {
            return;
        }
        if (rootX.rank < rootY.rank) {
            rootX.parent = rootY;
        } else if (rootX.rank > rootY.rank) {
            rootY.parent = rootX;
        } else {
            rootY.parent = rootX;
            rootX.rank++;
        }
    }

    /**
     * Finds and returns the root node of the set that contains node
     * @param {DisjointSetNode} node
     * @return {DisjointSetNode}
     */
    public find(node: DisjointSetNode<T>): DisjointSetNode<T> {
        let rootX = node;
        while (rootX.parent !== null) {
            rootX = rootX.parent;
        }
        let toUpdateX = node;
        while (toUpdateX.parent !== null) {
            const toUpdateParent = toUpdateX;
            toUpdateX = toUpdateX.parent;
            toUpdateParent.parent = rootX;
        }

        return rootX;
    }

    /**
     * Returns true if x and y belong to the same set
     * @param {DisjointSetNode} x
     * @param {DisjointSetNode} y
     */
    public connected(x: DisjointSetNode<T>, y: DisjointSetNode<T>): boolean {
        return this.find(x) === this.find(y);
    }
}

// tslint:disable-next-line max-classes-per-file
export class DisjointSetNode<T> {
    public parent: DisjointSetNode<T> | null;
    public rank: number;
    public value: T;

    public constructor(value: T) {
        this.value = value;
        this.parent = null;
        this.rank = 0;
    }

}
