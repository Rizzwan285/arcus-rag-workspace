/**
 * Evaluation corpus — a synthetic but realistic set of course passages.
 *
 * WHY SYNTHETIC
 * The production corpus is one PDF whose text layer is partly mangled by a
 * custom font encoding, which makes it useless as ground truth. A fixture
 * corpus is reproducible, can be re-seeded on any machine, and lets the query
 * set be labelled by construction.
 *
 * DESIGN
 * Passages are written to be genuinely confusable: each subject contains
 * several near-neighbours on the same topic that differ in specifics, so
 * retrieving "something about sorting" is not enough to score. Course codes,
 * named theorems, and acronyms appear in exactly the passages that define them,
 * which is what makes the lexical arm measurable.
 *
 * @see ADR-020 in .claude/decisions.md
 */

export type EvalDocumentKey = "dsa" | "linalg" | "ml" | "handbook";

export interface EvalPassage {
  /** Stable id, referenced by relevance judgements. */
  id: string;
  doc: EvalDocumentKey;
  text: string;
}

export const EVAL_DOCUMENTS: Record<EvalDocumentKey, string> = {
  dsa: "CS2010 — Data Structures and Algorithms",
  linalg: "MA1020 — Linear Algebra",
  ml: "DS2020 — Introduction to Machine Learning",
  handbook: "BTech Programme Handbook",
};

export const EVAL_CORPUS: EvalPassage[] = [
  // ── CS2010: Data Structures and Algorithms ──────────────────────────
  { id: "dsa-01", doc: "dsa", text: "Big-O notation describes an asymptotic upper bound on the growth of a function. Writing f(n) = O(g(n)) means there exist constants c and n0 such that f(n) <= c*g(n) for all n >= n0. It bounds the worst case from above but says nothing about tightness." },
  { id: "dsa-02", doc: "dsa", text: "Big-Theta notation describes a tight bound: f(n) = Theta(g(n)) when the function is bounded both above and below by g(n) up to constant factors. Reporting a Theta bound is a stronger claim than reporting an upper bound alone." },
  { id: "dsa-03", doc: "dsa", text: "Amortised analysis averages the cost of an operation over a sequence rather than looking at any single call. A dynamic array that doubles its capacity when full performs an expensive copy only occasionally, giving constant amortised cost per append." },
  { id: "dsa-04", doc: "dsa", text: "Arrays store elements contiguously, so indexing is constant time but inserting in the middle requires shifting every following element. Linked lists invert this: insertion at a known position is constant, but reaching position k costs k steps." },
  { id: "dsa-05", doc: "dsa", text: "A singly linked list stores one forward pointer per node, so traversal only runs in one direction. A doubly linked list adds a backward pointer, allowing removal of a node given only a reference to it, at the cost of extra memory per node." },
  { id: "dsa-06", doc: "dsa", text: "A stack is a last-in-first-out container supporting push and pop at one end. The function call stack is the canonical example: each nested call pushes a frame, and returning pops it, which is why unbounded recursion produces a stack overflow." },
  { id: "dsa-07", doc: "dsa", text: "A queue is a first-in-first-out container with enqueue at the back and dequeue at the front. Breadth-first traversal relies on a queue to visit nodes in order of increasing distance from the source." },
  { id: "dsa-08", doc: "dsa", text: "Separate chaining resolves hash collisions by storing all colliding keys in a bucket, usually a linked list. Lookup cost degrades to the length of the chain, so performance depends on the hash function distributing keys evenly." },
  { id: "dsa-09", doc: "dsa", text: "Open addressing resolves collisions inside the table itself. Linear probing scans forward from the hashed slot until it finds a free one, which is cache-friendly but suffers from primary clustering as the table fills." },
  { id: "dsa-10", doc: "dsa", text: "The load factor of a hash table is the ratio of stored entries to buckets. Once it exceeds a threshold, typically around 0.75, the table is resized and every key rehashed, which is why individual inserts occasionally cost far more than average." },
  { id: "dsa-11", doc: "dsa", text: "A binary search tree keeps every key in the left subtree smaller than the node and every key in the right subtree larger. Search, insert, and delete each cost time proportional to the height of the tree." },
  { id: "dsa-12", doc: "dsa", text: "Inserting already-sorted keys into an unbalanced binary search tree produces a degenerate tree: every node has one child, the structure collapses into a linked list, and operations degrade from logarithmic to linear time." },
  { id: "dsa-13", doc: "dsa", text: "AVL trees restore balance after an insertion using rotations. A single rotation fixes an outside imbalance and a double rotation fixes an inside one, keeping the height difference between siblings' subtrees at most one." },
  { id: "dsa-14", doc: "dsa", text: "Red-black trees maintain balance with colour invariants: the root is black, red nodes cannot have red children, and every path from a node to its descendant leaves contains the same number of black nodes. This bounds the height at twice the logarithm of the node count." },
  { id: "dsa-15", doc: "dsa", text: "B-trees keep many keys in each node so that one node fills a disk block. Reducing tree height reduces the number of block reads, which is why database indexes and filesystems use B-trees rather than binary trees." },
  { id: "dsa-16", doc: "dsa", text: "A binary heap is a complete tree where every parent compares favourably to its children. It backs a priority queue, giving constant-time access to the extreme element and logarithmic insertion and removal." },
  { id: "dsa-17", doc: "dsa", text: "Heapsort builds a heap from the input and repeatedly extracts the extreme element. It sorts in place with a guaranteed n log n bound, but its scattered memory access makes it slower in practice than quicksort on typical hardware." },
  { id: "dsa-18", doc: "dsa", text: "Quicksort partitions the array around a chosen pivot so that smaller elements precede it and larger ones follow, then recurses on both sides. Choosing the pivot at random makes adversarial inputs improbable." },
  { id: "dsa-19", doc: "dsa", text: "Quicksort degrades to quadratic time when the pivot repeatedly splits the array as unevenly as possible, for instance when the first element is chosen as pivot on already-sorted input." },
  { id: "dsa-20", doc: "dsa", text: "Mergesort is stable: equal elements retain their original relative order, because the merge step prefers the left run on ties. Quicksort's partition swaps distant elements and is not stable without extra bookkeeping." },
  { id: "dsa-21", doc: "dsa", text: "Counting sort and radix sort avoid comparisons entirely, bucketing by key value or digit. They beat the comparison lower bound only because they assume a bounded key range, which is not always available." },
  { id: "dsa-22", doc: "dsa", text: "Binary search requires the input to be sorted and randomly accessible. Each step halves the remaining interval, so it finds a key in logarithmic time; applying it to unsorted data silently returns wrong answers rather than failing." },
  { id: "dsa-23", doc: "dsa", text: "Depth-first search explores as far as possible along a branch before backtracking, using an explicit stack or recursion. It is the basis of cycle detection and of computing strongly connected components." },
  { id: "dsa-24", doc: "dsa", text: "Breadth-first search visits vertices in order of increasing edge count from the source, which makes it the correct algorithm for shortest paths in an unweighted graph. Weighted edges break this guarantee." },
  { id: "dsa-25", doc: "dsa", text: "Dijkstra's algorithm computes shortest paths from a single source in a weighted graph by repeatedly settling the nearest unsettled vertex. It assumes all edge weights are non-negative; a negative edge can make an already-settled vertex wrong." },
  { id: "dsa-26", doc: "dsa", text: "The Bellman-Ford algorithm handles graphs containing negative edge weights by relaxing every edge repeatedly, once per vertex minus one. A further relaxation that still improves a distance proves the presence of a negative cycle." },
  { id: "dsa-27", doc: "dsa", text: "A topological sort orders the vertices of a directed acyclic graph so every edge points forwards. It exists only when the graph has no cycle, and is how build systems and task schedulers decide execution order." },
  { id: "dsa-28", doc: "dsa", text: "Kruskal's algorithm builds a minimum spanning tree by sorting edges by weight and adding an edge whenever its endpoints lie in different components. A union-find structure with path compression makes the connectivity test near constant time." },
  { id: "dsa-29", doc: "dsa", text: "Prim's algorithm grows a minimum spanning tree from a starting vertex, repeatedly adding the cheapest edge that leaves the current tree. With a priority queue it is efficient on dense graphs, where Kruskal's sorting step dominates." },
  { id: "dsa-30", doc: "dsa", text: "Dynamic programming applies when a problem has overlapping subproblems and optimal substructure. Memoisation caches subproblem answers so each is computed once, turning an exponential recursion into a polynomial one." },
  { id: "dsa-31", doc: "dsa", text: "The 0/1 knapsack problem asks which subset of items of given weight and value maximises value under a capacity limit. The standard solution fills a table indexed by item count and remaining capacity." },
  { id: "dsa-32", doc: "dsa", text: "The longest common subsequence of two strings is found by filling a table where each cell depends on the diagonal, left, and upper neighbours. It underlies file diffing and sequence alignment." },

  // ── MA1020: Linear Algebra ──────────────────────────────────────────
  { id: "lin-01", doc: "linalg", text: "A vector space is a set closed under addition and scalar multiplication satisfying eight axioms, including associativity, the existence of a zero vector, and the existence of additive inverses. Familiar examples are the real coordinate spaces." },
  { id: "lin-02", doc: "linalg", text: "A set of vectors is linearly independent when the only linear combination producing the zero vector is the one with all coefficients zero. Any set containing the zero vector is automatically dependent." },
  { id: "lin-03", doc: "linalg", text: "The span of a set of vectors is the collection of all their linear combinations. Spanning says the set is large enough to reach every point; independence says it is not wastefully large." },
  { id: "lin-04", doc: "linalg", text: "A basis is a linearly independent spanning set. Every basis of a given space has the same number of elements, and that number is the dimension of the space." },
  { id: "lin-05", doc: "linalg", text: "The rank-nullity theorem states that for a linear map, the rank plus the nullity equals the dimension of the domain. Equivalently, the dimension of the column space plus the dimension of the null space equals the number of columns." },
  { id: "lin-06", doc: "linalg", text: "The column space of a matrix is the span of its columns and equals the set of vectors b for which Ax = b is solvable. The row space has the same dimension, which is why row rank equals column rank." },
  { id: "lin-07", doc: "linalg", text: "The null space of a matrix is the set of all solutions to Ax = 0. It is a subspace, and its dimension, the nullity, counts the free variables remaining after elimination." },
  { id: "lin-08", doc: "linalg", text: "Matrix multiplication is associative and distributive but not commutative: AB and BA generally differ, and may not even have compatible shapes. Order therefore encodes the order in which transformations are applied." },
  { id: "lin-09", doc: "linalg", text: "The identity matrix leaves every vector unchanged. A square matrix A is invertible when some B satisfies AB = BA = I, and that inverse, when it exists, is unique." },
  { id: "lin-10", doc: "linalg", text: "The determinant is multiplicative, so det(AB) = det(A)det(B), and it changes sign under a row swap. Scaling a single row by c scales the determinant by c." },
  { id: "lin-11", doc: "linalg", text: "A square matrix is invertible exactly when its determinant is non-zero. A zero determinant means the columns are linearly dependent and the transformation collapses space onto a lower-dimensional subspace." },
  { id: "lin-12", doc: "linalg", text: "Gaussian elimination reduces a matrix to row echelon form using row operations, exposing pivots and free variables. Partial pivoting swaps rows to place the largest available entry on the diagonal, which limits the growth of rounding error." },
  { id: "lin-13", doc: "linalg", text: "LU decomposition factors a matrix into a lower triangular and an upper triangular matrix. Once computed, solving Ax = b for many different right-hand sides costs only two triangular solves each." },
  { id: "lin-14", doc: "linalg", text: "An eigenvector of A is a non-zero vector whose direction is unchanged by the transformation: Av = lambda*v, where the scalar lambda is the corresponding eigenvalue." },
  { id: "lin-15", doc: "linalg", text: "The characteristic polynomial is det(A - lambda*I), and its roots are the eigenvalues. Its degree equals the size of the matrix, so an n-by-n matrix has n eigenvalues counted with multiplicity." },
  { id: "lin-16", doc: "linalg", text: "A matrix is diagonalisable when it has a full set of linearly independent eigenvectors, allowing it to be written as P D P inverse. Raising a diagonalisable matrix to a power then reduces to raising the diagonal entries to that power." },
  { id: "lin-17", doc: "linalg", text: "The spectral theorem states that every real symmetric matrix has an orthonormal basis of eigenvectors and only real eigenvalues. Such a matrix is therefore orthogonally diagonalisable." },
  { id: "lin-18", doc: "linalg", text: "Two vectors are orthogonal when their dot product is zero, which corresponds to meeting at a right angle. A set of mutually orthogonal unit vectors is called orthonormal." },
  { id: "lin-19", doc: "linalg", text: "The Gram-Schmidt process turns a linearly independent set into an orthonormal one by subtracting from each vector its projection onto the vectors already processed, then normalising the remainder." },
  { id: "lin-20", doc: "linalg", text: "QR decomposition writes a matrix as an orthogonal matrix times an upper triangular one. It is the numerically stable route to least squares, avoiding the squaring of the condition number that the normal equations introduce." },
  { id: "lin-21", doc: "linalg", text: "The orthogonal projection of a vector onto a subspace is the closest point in that subspace, and the residual is orthogonal to every vector in it. This minimising property is what makes projection the right tool for approximation." },
  { id: "lin-22", doc: "linalg", text: "When Ax = b has no exact solution, the least squares solution minimises the squared residual and satisfies the normal equations A transpose A x = A transpose b. Geometrically it projects b onto the column space of A." },
  { id: "lin-23", doc: "linalg", text: "The singular value decomposition factors any matrix, square or not, as U Sigma V transpose, with orthogonal U and V and non-negative singular values on the diagonal of Sigma. Truncating the small singular values gives the best low-rank approximation." },
  { id: "lin-24", doc: "linalg", text: "The Cauchy-Schwarz inequality bounds the absolute value of an inner product by the product of the norms. Equality holds precisely when the two vectors are parallel, and the triangle inequality follows from it." },
  { id: "lin-25", doc: "linalg", text: "A norm measures vector length and must be positive, absolutely homogeneous, and satisfy the triangle inequality. The Euclidean norm, the taxicab norm, and the maximum norm are the common choices." },

  // ── DS2020: Machine Learning ────────────────────────────────────────
  { id: "ml-01", doc: "ml", text: "Supervised learning fits a mapping from inputs to known labels, while unsupervised learning looks for structure in unlabelled data. Clustering and dimensionality reduction are the standard unsupervised tasks." },
  { id: "ml-02", doc: "ml", text: "Data is split into training, validation, and test partitions. The training set fits parameters, the validation set selects hyperparameters, and the test set is touched once, at the end, to estimate generalisation." },
  { id: "ml-03", doc: "ml", text: "K-fold cross-validation partitions the data into k parts, trains on k-1 of them and validates on the remainder, rotating through all folds. Averaging the results uses every example for validation exactly once and gives a lower-variance estimate than a single split." },
  { id: "ml-04", doc: "ml", text: "A model overfits when it captures noise specific to the training set, achieving low training error and high test error. The gap between the two curves is the diagnostic signal." },
  { id: "ml-05", doc: "ml", text: "A model underfits when it is too constrained to represent the underlying pattern, showing high error on both training and test data. Increasing capacity or adding features is the usual remedy." },
  { id: "ml-06", doc: "ml", text: "The bias-variance tradeoff decomposes expected error into bias from wrong assumptions, variance from sensitivity to the particular sample, and irreducible noise. Reducing one term typically increases the other." },
  { id: "ml-07", doc: "ml", text: "L2 regularisation, also called ridge, adds the squared magnitude of the weights to the loss. It shrinks coefficients smoothly towards zero without eliminating them, which stabilises models with correlated features." },
  { id: "ml-08", doc: "ml", text: "L1 regularisation, also called lasso, penalises the absolute value of the weights. Its corner at the origin drives some coefficients exactly to zero, so it performs feature selection as a side effect of fitting." },
  { id: "ml-09", doc: "ml", text: "Gradient descent minimises a loss by stepping in the direction opposite the gradient. Convergence requires the step size to be small enough that the linear approximation remains valid locally." },
  { id: "ml-10", doc: "ml", text: "The learning rate controls step size. Set it too high and the loss oscillates or diverges; set it too low and training crawls. Schedules that decay it over time combine fast early progress with a stable finish." },
  { id: "ml-11", doc: "ml", text: "Batch gradient descent computes the gradient over the whole dataset, giving a smooth but expensive update. Stochastic gradient descent uses one example or a mini-batch, trading gradient noise for far more updates per unit of computation." },
  { id: "ml-12", doc: "ml", text: "Momentum accumulates an exponentially weighted average of past gradients to damp oscillation across narrow valleys. Adam extends this with per-parameter step sizes derived from the second moment of the gradient." },
  { id: "ml-13", doc: "ml", text: "Linear regression fits a straight-line relationship by minimising mean squared error. The squared penalty makes it sensitive to outliers, since a single distant point contributes quadratically." },
  { id: "ml-14", doc: "ml", text: "Logistic regression models the probability of a binary outcome by passing a linear combination of the features through the sigmoid function. Despite the name it is a classifier, not a regressor." },
  { id: "ml-15", doc: "ml", text: "Cross-entropy loss measures the distance between the predicted probability distribution and the true labels. It penalises confident wrong predictions steeply, which produces stronger gradients than squared error for classification." },
  { id: "ml-16", doc: "ml", text: "The softmax function converts a vector of scores into a probability distribution by exponentiating and normalising. Subtracting the maximum score before exponentiating avoids numerical overflow." },
  { id: "ml-17", doc: "ml", text: "A decision tree splits the feature space by repeatedly choosing the test that most reduces impurity, measured by entropy or the Gini index. Grown without limit it will memorise the training set, so depth or leaf size is constrained." },
  { id: "ml-18", doc: "ml", text: "Random forests train many trees on bootstrap samples and randomly restricted feature subsets, then average their predictions. Decorrelating the trees is what reduces variance relative to a single deep tree." },
  { id: "ml-19", doc: "ml", text: "Gradient boosting fits trees sequentially, each one to the residual errors of the ensemble so far. It typically achieves higher accuracy than bagging but is more sensitive to hyperparameters and easier to overfit." },
  { id: "ml-20", doc: "ml", text: "A support vector machine finds the separating hyperplane with the largest margin to the nearest training points. Only those closest points, the support vectors, determine the boundary." },
  { id: "ml-21", doc: "ml", text: "The kernel trick lets a linear method operate in a high-dimensional feature space by replacing inner products with a kernel function, without ever computing the coordinates explicitly. Radial basis and polynomial kernels are the common choices." },
  { id: "ml-22", doc: "ml", text: "K-nearest neighbours classifies a point by majority vote among its closest training examples. It requires no training phase, but prediction cost grows with the dataset and accuracy degrades badly in high dimensions." },
  { id: "ml-23", doc: "ml", text: "K-means partitions data into k clusters by alternating between assigning points to the nearest centroid and recomputing centroids. It converges to a local optimum that depends on initialisation, so it is usually restarted several times." },
  { id: "ml-24", doc: "ml", text: "Principal component analysis projects data onto the directions of greatest variance, which are the leading eigenvectors of the covariance matrix. Keeping only the first few components reduces dimensionality while retaining most of the variation." },
  { id: "ml-25", doc: "ml", text: "A confusion matrix tabulates predictions against truth. Precision is the fraction of predicted positives that are correct; recall is the fraction of actual positives that were found. Tightening a threshold usually raises one and lowers the other." },
  { id: "ml-26", doc: "ml", text: "The F1 score is the harmonic mean of precision and recall, summarising both in one number. The harmonic mean is used because it punishes a large gap between the two more than an arithmetic mean would." },
  { id: "ml-27", doc: "ml", text: "The ROC curve plots true positive rate against false positive rate across every threshold, and the AUC summarises it as a single number. AUC is threshold-independent but can look flattering on heavily imbalanced data." },
  { id: "ml-28", doc: "ml", text: "With severe class imbalance, accuracy is misleading because always predicting the majority class scores well. Resampling, class weighting, and reporting precision and recall per class are the standard responses." },

  // ── BTech Programme Handbook ────────────────────────────────────────
  { id: "hb-01", doc: "handbook", text: "The BTech programme requires a total of 160 credits for the award of the degree, distributed across institute core, programme core, programme major electives, open electives, and project work." },
  { id: "hb-02", doc: "handbook", text: "Programme core courses account for 62 credits and are compulsory for every student in the discipline. They are normally taken in the prescribed semester, as later courses assume them as prerequisites." },
  { id: "hb-03", doc: "handbook", text: "Programme major electives allow specialisation within the discipline and contribute 18 credits in total, usually taken as six three-credit courses from semester five onwards." },
  { id: "hb-04", doc: "handbook", text: "Open electives contribute 12 credits and must be taken from outside the parent department. They are intended to broaden exposure, and a course already credited as a programme elective cannot be double counted." },
  { id: "hb-05", doc: "handbook", text: "A minimum CGPA of 5.0 is required for the award of the degree. A student whose CGPA falls below this at the end of any academic year is placed on academic probation." },
  { id: "hb-06", doc: "handbook", text: "Letter grades carry the following points: S is 10, A is 9, B is 8, C is 7, D is 6, E is 5, and U denotes failure with zero points. The U grade is counted in the CGPA until the course is cleared." },
  { id: "hb-07", doc: "handbook", text: "A student must attend at least 75 percent of the scheduled sessions in a course to be permitted to sit its end-semester examination. Shortfall results in a W grade and the course must be repeated." },
  { id: "hb-08", doc: "handbook", text: "Course codes follow a fixed scheme: two letters for the discipline, then four digits, of which the first indicates the year of study. CS2010 is therefore a second-year Computer Science course and DS2020 a second-year Data Science course." },
  { id: "hb-09", doc: "handbook", text: "Registration for the following semester closes two weeks before instruction begins. Late registration attracts a fee and requires the approval of the faculty adviser." },
  { id: "hb-10", doc: "handbook", text: "Courses may be added or dropped without penalty during the first two weeks of the semester. After this add-drop window the registration is final and appears on the transcript." },
  { id: "hb-11", doc: "handbook", text: "A student may withdraw from a course up to the end of week eight, receiving a W grade that does not affect the CGPA. Withdrawal is not permitted if it takes the registered load below the minimum of 15 credits." },
  { id: "hb-12", doc: "handbook", text: "A makeup examination is granted only for documented medical emergencies or institute-approved travel, and the request must reach the academic office within seven days of the missed examination." },
  { id: "hb-13", doc: "handbook", text: "Plagiarism, unauthorised collaboration, and the use of prohibited material in an examination are violations of academic integrity. Confirmed cases are referred to the disciplinary committee and may result in a U grade for the course or suspension." },
  { id: "hb-14", doc: "handbook", text: "Project I carries 3 credits in semester seven and Project II carries 6 credits in semester eight. Project II requires a written thesis and an oral defence before a panel." },
  { id: "hb-15", doc: "handbook", text: "A summer internship of at least eight weeks is compulsory after semester six. It carries 2 credits, is graded on a pass or fail basis, and requires both a report and the host organisation's evaluation." },
  { id: "hb-16", doc: "handbook", text: "The academic year comprises two semesters of fifteen instructional weeks each, followed by an examination period. An optional summer term allows students to clear backlogs." },
  { id: "hb-17", doc: "handbook", text: "A student carrying a backlog may re-register for the course in a later semester or attempt it in the summer term. The improved grade replaces the earlier one in the CGPA, though the original attempt remains on the transcript." },
  { id: "hb-18", doc: "handbook", text: "To be eligible for convocation a student must have cleared all courses, met the 160 credit requirement, obtained a CGPA of at least 5.0, and settled all institute dues." },
];

/** Passages grouped by their synthetic parent document. */
export function corpusByDocument(): Record<EvalDocumentKey, EvalPassage[]> {
  const grouped = { dsa: [], linalg: [], ml: [], handbook: [] } as Record<
    EvalDocumentKey,
    EvalPassage[]
  >;
  for (const passage of EVAL_CORPUS) grouped[passage.doc].push(passage);
  return grouped;
}
