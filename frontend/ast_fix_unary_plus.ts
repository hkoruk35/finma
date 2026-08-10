import { Project, SyntaxKind, CallExpression, PrefixUnaryExpression } from "ts-morph";

const project = new Project({
    tsConfigFilePath: "C:/Users/afksm/finma/frontend/tsconfig.json",
});

let modifiedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes("node_modules") || sourceFile.getFilePath().includes(".next")) {
        continue;
    }

    let fileModified = false;

    // Find all PrefixUnaryExpressions
    const allUnary = sourceFile.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression);
    
    for (let i = allUnary.length - 1; i >= 0; i--) {
        const expr = allUnary[i];
        
        if (expr.getOperatorToken() === SyntaxKind.PlusToken) {
            const operand = expr.getOperand();
            
            if (operand.getKind() === SyntaxKind.CallExpression) {
                const callExpr = operand as CallExpression;
                if (callExpr.getExpression().getText() === "formatNumber") {
                    const args = callExpr.getArguments();
                    if (args.length >= 1) {
                        const A = args[0].getText();
                        const B = args.length >= 2 ? args[1].getText() : "2";
                        
                        // Replace +formatNumber(A, B) with +((A).toFixed(B))
                        expr.replaceWithText(`+((${A}).toFixed(${B}))`);
                        fileModified = true;
                    }
                }
            }
        }
    }

    if (fileModified) {
        sourceFile.saveSync();
        modifiedFiles++;
        console.log(`Modified: ${sourceFile.getFilePath()}`);
    }
}

console.log(`Successfully modified ${modifiedFiles} files.`);
