import { Project, SyntaxKind, CallExpression } from "ts-morph";

const project = new Project({
    tsConfigFilePath: "C:/Users/afksm/finma/frontend/tsconfig.json",
});

let modifiedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes("node_modules") || sourceFile.getFilePath().includes(".next")) {
        continue;
    }

    let fileModified = false;

    // Find all CallExpressions
    const allCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (let i = allCalls.length - 1; i >= 0; i--) {
        const callExpr = allCalls[i];
        const expression = callExpr.getExpression().getText();
        
        if (expression === "Number" || expression === "parseFloat") {
            const args = callExpr.getArguments();
            if (args.length === 1 && args[0].getKind() === SyntaxKind.CallExpression) {
                const innerCall = args[0] as CallExpression;
                if (innerCall.getExpression().getText() === "formatNumber") {
                    const innerArgs = innerCall.getArguments();
                    if (innerArgs.length >= 1) {
                        const A = innerArgs[0].getText();
                        const B = innerArgs.length >= 2 ? innerArgs[1].getText() : "2";
                        
                        // Replace Number(formatNumber(A, B)) with Number((A).toFixed(B))
                        callExpr.replaceWithText(`${expression}((${A}).toFixed(${B}))`);
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
