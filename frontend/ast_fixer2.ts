import { Project, SyntaxKind, CallExpression, PropertyAccessExpression, Node } from "ts-morph";

const project = new Project({
    tsConfigFilePath: "C:/Users/afksm/finma/frontend/tsconfig.json",
});

let modifiedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes("node_modules") || sourceFile.getFilePath().includes(".next")) {
        continue;
    }

    let fileModified = false;
    let needsFormatNumberImport = false;

    // We get all CallExpressions
    const allCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    for (let i = allCalls.length - 1; i >= 0; i--) {
        const callExpr = allCalls[i];
        const expression = callExpr.getExpression();
        
        if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = expression as PropertyAccessExpression;
            const methodName = propAccess.getName();
            const lhsNode = propAccess.getExpression();
            const lhsText = lhsNode.getText();
            
            if (methodName === "toFixed") {
                const args = callExpr.getArguments();
                const decimals = args.length > 0 ? args[0].getText() : "0";
                
                // Don't replace if it's already inside a formatNumber call (shouldn't happen but just in case)
                callExpr.replaceWithText(`formatNumber(${lhsText}, ${decimals})`);
                fileModified = true;
                needsFormatNumberImport = true;
            } 
            else if (methodName === "toLocaleString") {
                // If the LHS is clearly a Date object, DO NOT touch it.
                // We check if it's `new Date(...)` or `now.toLocaleString` etc
                const isDate = lhsText.includes("Date") || lhsText === "now" || lhsText === "et" || lhsText.includes("latest") || lhsText.includes("time") || lhsText.includes("timestamp");
                
                // Also check if args contain "timeZone"
                const argsText = callExpr.getArguments().map(a => a.getText()).join(", ");
                const hasTimeZone = argsText.includes("timeZone") || argsText.includes("hour");
                
                if (!isDate && !hasTimeZone) {
                    // It's likely a number
                    // e.g. .toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
                    // We can replace it with formatNumber
                    
                    // Let's see if we can extract 'd' or '2'
                    let decimals = "0"; // default to 0 if no args
                    if (argsText.includes("minimumFractionDigits: ")) {
                        const match = argsText.match(/minimumFractionDigits:\s*([a-zA-Z0-9_]+)/);
                        if (match) decimals = match[1];
                    } else if (argsText.includes("minimumFractionDigits:")) { // without space
                        const match = argsText.match(/minimumFractionDigits:([a-zA-Z0-9_]+)/);
                        if (match) decimals = match[1];
                    }
                    
                    // Replace
                    callExpr.replaceWithText(`formatNumber(${lhsText}, ${decimals})`);
                    fileModified = true;
                    needsFormatNumberImport = true;
                }
            }
        }
    }

    if (fileModified) {
        if (needsFormatNumberImport) {
            const hasFormatNumberImport = sourceFile.getImportDeclarations().some(imp => 
                imp.getNamedImports().some(n => n.getName() === "formatNumber")
            );
            if (!hasFormatNumberImport) {
                sourceFile.addImportDeclaration({
                    namedImports: ["formatNumber"],
                    moduleSpecifier: "@/lib/formatNumber"
                });
            }
        }
        
        sourceFile.saveSync();
        modifiedFiles++;
        console.log(`Modified: ${sourceFile.getFilePath()}`);
    }
}

console.log(`Successfully modified ${modifiedFiles} files.`);
