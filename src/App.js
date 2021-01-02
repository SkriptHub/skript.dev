import './App.css';
import { ControlledEditor } from "@monaco-editor/react";
import { monaco } from '@monaco-editor/react';
import { Navbar, Alignment, Tooltip, InputGroup, Button, Classes, Popover, Position, HTMLTable, Intent} from "@blueprintjs/core";
import debounce from 'lodash/debounce'
import flatMap from 'lodash/flatMap'  
import React, { useState, useRef, useEffect } from "react";
import SkriptHubLogo from "./img/SkriptHubLogoWhite.svg"
import axios from "axios"
import { AppToaster } from "./components/Toaster";
import ReactGA from "react-ga";

ReactGA.initialize("G-JM8FWFTDGE");
ReactGA.pageview(window.location.pathname + window.location.search);

function App() {
  const [theme] = useState("dark");
  const [language] = useState("skript");
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [parseUrl, setParseUrl] = useState("http://localhost:8020/parse");
  const [value, setValue] = useState("# Put you script below");
  const [scriptErrors, setScriptErrors] = useState([]);
  const [scriptWarnings, setScriptWarnings] = useState([]);
  const [syntaxList, setSyntaxList] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const editorInstance = useRef();

  function buildValuePattern(baseValue) {
    function convert(match) {
        return "${1:" + match + "}";
    }
    let regex = /(%)(?:(?=(\\?))\2.)*?\1/
    return baseValue.replace(regex, convert);
  }

  function buildActiveCompletionItems(monacoIns) {
    return flatMap(syntaxList, (syntax) => {
      let syntax_pattern_list = syntax.syntax_pattern.split('\n');
      let completionItems = [];
      let i;
      for (i = 0; i < syntax_pattern_list.length; i++) { 
        // Add ":\n\t" for events
        if(syntax.syntax_type === 'event'){
          completionItems.push({
            label: syntax_pattern_list[i],
            kind: monacoIns.languages.CompletionItemKind.Snippet,
            insertText: buildValuePattern(syntax_pattern_list[i]) + ':\n\t',
            insertTextRules: monacoIns.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: syntax.title + " - " + syntax.syntax_type + " - " + syntax.addon.name,
            documentation: syntax.description
          });
          continue;
        }
      

        completionItems.push({
            label: syntax_pattern_list[i],
            kind: monacoIns.languages.CompletionItemKind.Snippet,
            insertText: buildValuePattern(syntax_pattern_list[i]),
            detail: syntax.title + " - " + syntax.syntax_type + " - " + syntax.addon.name,
            insertTextRules: monacoIns.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: syntax.description
        });
      }
      return completionItems;
  });
}

  function handleEditorDidMount(_, editor) {
    setIsEditorReady(true);
    editorInstance.current = editor;

    monaco
    .init()
    .then((monacoInstance) => {
      // Register a new language
      monacoInstance.languages.register({ id: "skript" });
    
      // Register a tokens provider for the language
      monacoInstance.languages.setMonarchTokensProvider("skript", {
        keywords: [
          'set', 'continue', 'for', 'new', 'switch', 'assert', 'goto', 'do',
          'if', 'private', 'this', 'break', 'protected', 'throw', 'else', 'public',
          'enum', 'return', 'catch', 'try', 'interface', 'static', 'class',
          'finally', 'const', 'super', 'while', 'true', 'false', "trigger"
        ],
      
        typeKeywords: [
          'boolean', 'double', 'byte', 'int', 'short', 'char', 'void', 'long', 'float'
        ],
      
        operators: [
          '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
          '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
          '<<', '>>', '>>>', '+=', '-=', '*=', '/=',
        ],
  
        tokenizer: {
          root: [
            { include: '@whitespace' },
            { include: '@numbers' },
            { include: '@strings' },
            { include: '@skriptOptionsVariable' },
            { include: '@skriptVariables' },
            
      
            [/[,:;]/, 'delimiter'],
            [/[{}[\]()%]/, '@brackets'],
      
            [/@[a-zA-Z]\w*/, 'tag'],
            [/[a-zA-Z]\w*/, {
              cases: {
                '@typeKeywords': 'keyword',
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }]
          ],
          whitespace: [
            [/\s+/, 'white'],
            [/(^#.*$)/, 'comment'],
            [/('''.*''')|(""".*""")/, 'string'],
            [/'''.*$/, 'string', '@endDocString'],
            [/""".*$/, 'string', '@endDblDocString']
          ],
          endDocString: [
            [/\\'/, 'string'],
            [/.*'''/, 'string', '@popall'],
            [/.*$/, 'string']
          ],
          endDblDocString: [
            [/\\"/, 'string'],
            [/.*"""/, 'string', '@popall'],
            [/.*$/, 'string']
          ],
      
          // Recognize hex, negatives, decimals, imaginaries, longs, and scientific notation
          numbers: [
            [/-?0x([abcdef]|[ABCDEF]|\d)+[lL]?/, 'number.hex'],
            [/-?(\d*\.)?\d+([eE][+-]?\d+)?[jJ]?[lL]?/, 'number']
          ],
      
          // Recognize strings, including those broken across lines with \ (but not without)
          strings: [
            [/'$/, 'string.escape', '@popall'],
            [/'/, 'string.escape', '@stringBody'],
            [/"$/, 'string.escape', '@popall'],
            [/"/, 'string.escape', '@dblStringBody']
          ],
          stringBody: [
            [/\\./, 'string'],
            [/'/, 'string.escape', '@popall'],
            [/.(?=.*')/, 'string'],
            [/.*\\$/, 'string'],
            [/.*$/, 'string', '@popall']
          ],
          dblStringBody: [
            [/\\./, 'string'],
            [/"/, 'string.escape', '@popall'],
            [/.(?=.*")/, 'string'],
            [/.*\\$/, 'string'],
            [/.*$/, 'string', '@popall']
          ],
          skriptVariables: [
            [/}$/, 'skriptVariable.escape', '@popall'],
            [/{/, 'skriptVariable.escape', '@skriptVariablesBody']
          ],
          skriptVariablesBody: [
            [/\\./, 'skriptVariable'],
            [/}/, 'skriptVariable.escape', '@popall'],
            [/.(?=.*})/, 'skriptVariable'],
            [/.*\\$/, 'skriptVariable'],
            [/.*$/, 'skriptVariable', '@popall']
          ],
          skriptOptionsVariable: [
            [/}$/, 'skriptOptions.escape', '@popall'],
            [/{@/, 'skriptOptions.escape', '@skriptOptionsVariableBody']
          ],
          skriptOptionsVariableBody: [
            [/\\./, 'skriptOptions'],
            [/}/, 'skriptOptions.escape', '@popall'],
            [/.(?=.*})/, 'skriptOptions'],
            [/.*\\$/, 'skriptOptions'],
            [/.*$/, 'skriptOptions', '@popall']
          ],
          
        },
        brackets: [
          { open: '[', close: ']', token: 'delimiter.bracket' },
          { open: '(', close: ')', token: 'delimiter.parenthesis' },
        ],
      });

      monacoInstance.languages.setLanguageConfiguration("skript", {
        comments: {
          lineComment: '#',
          blockComment: ['\'\'\'', '\'\'\''],
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '%', close: '%' },
          { open: '"', close: '"', notIn: ['string'] },
          { open: '\'', close: '\'', notIn: ['string', 'comment'] },
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '%', close: '%' },
          { open: '"', close: '"' },
          { open: '\'', close: '\'' },
        ],
        onEnterRules: [
          {
            beforeText: new RegExp("^\\s*(?:def|on|class|for|if|elif|else|while|try|with|finally|except|async).*?:\\s*$"),
            action: { indentAction: monacoInstance.languages.IndentAction.Indent }
          }
        ],
        folding: {
          offSide: true,
          markers: {
            start: new RegExp("^\\s*#region\\b"),
            end: new RegExp("^\\s*#endregion\\b")
          }
        }
      })
      
    })
    .catch((error) =>
      console.error("An error occurred during initialization of Monaco: ", error)
    );

    axios.get("https://skripthub.net/api/v1/addonsyntaxlist/")
    .then(response => {
      setSyntaxList(response.data);
    })
  }

  useEffect(() => {
    console.log(scriptErrors)

    if (editorInstance.current == undefined){
      return
    }

    var ListOfErrors = [];
    var ListOfLines = value.split("\n")

    monaco
    .init()
    .then((monacoInstance) => {

      for (let error of scriptErrors) {
        var linelookup = (error.line === 0) ? 0 : error.line - 1;
        var errorObject = {
          startLineNumber: error.line,
          startColumn: 0,
          endLineNumber: error.line,
          endColumn: ListOfLines[linelookup].length + 1,
          message: error.message,
          severity: monacoInstance.MarkerSeverity.Error
        }

        ListOfErrors.push(errorObject);
      }

      monacoInstance.editor.setModelMarkers(editorInstance.current.getModel(), "errors", ListOfErrors);
    });
  }, [scriptErrors]);

  useEffect(() => {
    console.log(syntaxList)

    if (editorInstance.current == undefined){
      return
    }

    monaco
    .init()
    .then((monacoInstance) => {
      const completionItems = buildActiveCompletionItems(monacoInstance);

      console.log(completionItems);

      // Register a completion item provider for the new language
      monacoInstance.languages.registerCompletionItemProvider("skript", {
        provideCompletionItems: () => { return {suggestions: completionItems} }
      });
    });
  }, [syntaxList]);

  useEffect(() => {
    console.log(scriptWarnings)
    if (editorInstance.current === undefined){
      return
    }
    var ListOfWarnings = [];
    var ListOfLines = value.split("\n")

    monaco
    .init()
    .then((monacoInstance) => {
      for (let warning of scriptWarnings) {
        var linelookup = (warning.line === 0) ? 0 : warning.line - 1;
        var warningObject = {
          startLineNumber: warning.line,
          startColumn: 0,
          endLineNumber: warning.line,
          endColumn: ListOfLines[linelookup].length + 1,
          message: warning.message,
          severity: monacoInstance.MarkerSeverity.Error
        }
        ListOfWarnings.push(warningObject);
      }

      monacoInstance.editor.setModelMarkers(editorInstance.current.getModel(), "warnings", ListOfWarnings);
    });
  }, [scriptWarnings]);

  function parseSkript() {
    setIsParsing(true)
    axios.post(parseUrl, {
      script: value
    }).then(function (response) {
      setScriptErrors(response.data.errors);
      setScriptWarnings(response.data.warnings);
      setIsParsing(false)
    }).catch(err => {
      AppToaster.show({ 
        message: `${err}`,
        intent: Intent.DANGER
      });
      setIsParsing(false)
    });
  }

  const delayedParsing = useRef(debounce(() => parseSkript(), 200)).current;

  const handleEditorChange = (ev, localValue) => {
    setValue(localValue);
    delayedParsing();
  };

  const getListOfDetails = (listOfValues) => {
    const tableBody = listOfValues.map((value) =>
      <tr>
        <td>{value.line}</td>
        <td>{value.message}</td>
      </tr>
    );

    return <HTMLTable interactive={true} bordered={true} striped={true}>
      <thead>
        <tr>
          <th>Line</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        {tableBody}
      </tbody>
    </HTMLTable>
  };

  return (
    <>
      <Navbar className="bp3-dark">
        <Navbar.Group align={Alignment.LEFT}>
            <Navbar.Heading>Skript.Dev by</Navbar.Heading>
            <img src={SkriptHubLogo} style={{height: "30px"}} alt="Skript Hub Logo"/>
            <Navbar.Divider />
            <a href="https://skripthub.net/docs/"><Button className={Classes.MINIMAL} icon="book" text="Skript Docs" /></a>
            <a href="https://skripthub.net/tutorials/"><Button className={Classes.MINIMAL} icon="annotation" text="Skript Tutorials" /></a>
        </Navbar.Group>

        <Navbar.Group align={Alignment.RIGHT}>
          <Tooltip content="Set your Parsing servers URL. If you are running it as a server on your computer its probably http://localhost:8020/parse">
            <InputGroup
                leftIcon="cloud"
                onChange={e => setParseUrl(e.target.value)}
                placeholder="Parsing Server URL..."
                value={parseUrl}
                style={{marginRight: "6px"}}
            />
          </Tooltip>
          <Button style={{marginLeft: "10px"}} icon="refresh" text="Parse" loading={isParsing} onClick={e => parseSkript()} />
        </Navbar.Group>
      </Navbar>
      <div style={{flexGrow: 1}}>
        <ControlledEditor
            theme={theme}
            language={language}
            value={value}
            onChange={handleEditorChange}
            editorDidMount={handleEditorDidMount}
            loading={"Loading..."}
          />
      </div>
      <div className="bp3-dark" style={{height: "30px", background: "#634DBF"}}>
        <div style={{float: "right"}}>
          <Popover className="bp3-dark" position={Position.BOTTOM_RIGHT} usePortal={false} content={<div class="warning-popover">{getListOfDetails(scriptWarnings)}</div>}>
            <Button className={Classes.MINIMAL} icon="warning-sign">{scriptWarnings.length}</Button>
          </Popover>
          <Popover className="bp3-dark" position={Position.BOTTOM_RIGHT} usePortal={false} content={<div class="warning-popover">{getListOfDetails(scriptErrors)}</div>}>
            <Button className={Classes.MINIMAL} icon="error">{scriptErrors.length}</Button>
          </Popover>
        </div>
      </div>
    </>
  );
}

export default App;
