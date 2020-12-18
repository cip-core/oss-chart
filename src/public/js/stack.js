const apiBaseUrl = window.location.href

let tabindex = 1;

// TODO : for testing purpose
const components = [
  {
    short: 'k8s',
    name: 'Kubernetes',
    href: '',
  },
  {
    short: 'docker',
    name: 'Docker',
    href: '',
  },
  {
    short: 'helm',
    name: 'Helm',
    href: '',
  },
];
const componentStacks = [
  {
    name: 'Stack 1',
    components: components,
  },
  {
    name: 'Stack 2',
    components: components.slice(1),
  },
  {
    name: 'Stack 3',
    components: components.slice(2),
  },
];
const companies = [
  {
    name: 'Google',
  },
  {
    name: 'Microsoft',
  },
  {
    name: 'Amazon',
  },
];
const companyStacks = [
  {
    name: 'Group 1',
    components: companies,
  },
  {
    name: 'Group 2',
    components: companies.slice(1),
  },
  {
    name: 'Group 3',
    components: companies.slice(2),
  },
];

async function loadComponents() {
  return components;
}

async function loadComponentStacks() {
  return componentStacks;
}

function appendElement(parent, tagName, attributes = {}) {
  const element = document.createElement(tagName);
  for (const key of Object.keys(attributes)) {
    element.setAttribute(key, attributes[key]);
  }
  parent.append(element);
  return element;
}

function resetPage() {
  document.body.innerHTML = '';
  tabindex = 1;
}

const title1 = appendElement(document.body, 'h2');
title1.innerHTML = 'Components';

const componentsButtonsGrid = appendElement(document.body, 'div', {
  class: 'buttonsGrid',
});

const createButton = appendElement(componentsButtonsGrid, 'button');
createButton.innerHTML = 'Create';

const editButton = appendElement(componentsButtonsGrid, 'button');
editButton.innerHTML = 'Edit';

const deleteButton = appendElement(componentsButtonsGrid, 'button');
deleteButton.innerHTML = 'Delete';

const title2 = appendElement(document.body, 'h2');
title2.innerHTML = 'Companies';

const companiesButtonsGrid = appendElement(document.body, 'div', {
  class: 'buttonsGrid',
});

function createSubGrid(parent, textLabel) {
  const subGrid = appendElement(parent, 'div', {
    class: 'subGrid',
  });

  const label = appendElement(subGrid, 'label');
  label.innerHTML = textLabel;

  return subGrid;
}

function getSelectedItems(selection) {
  return Array.from(selection.listElements).filter(element => element.className.indexOf('active') !== -1).map(element => element.getAttribute('data-value'));
}

function createSelection(parent, id, callback, multiple, placeholder, disabled = false) {
  const selectAttributes = {
    id: id,
  };
  if (multiple) {
    selectAttributes.multiple = '';
    selectAttributes.size = '1';
  }
  const select = appendElement(parent, 'select', selectAttributes);

  const selectionOptions = {
    search: true,
    maxHeight: 400,
    disableSelectAll: true,
  };

  if (placeholder) selectionOptions.placeHolder = placeholder;

  let multipleSelection = new vanillaSelectBox(`#${id}`, selectionOptions);
  const pointer = {};
  callback().then(function (values) {
    multipleSelection = pointer.selection;
    const listener = multipleSelection.main.lastElementChild.onclick;
    for (const value of values) {
      const option = document.createElement('option');
      option.setAttribute('value', value.short || value.name);
      option.innerHTML = value.name;
      select.append(option);
    }
    multipleSelection.destroy();

    if (!disabled) delete selectionOptions.placeHolder;
    const localTabindex = multipleSelection.main.getAttribute('tabindex');
    multipleSelection = new vanillaSelectBox(`#${id}`, selectionOptions);
    multipleSelection.responseValues = values;
    multipleSelection.main.setAttribute('tabindex', localTabindex);
    if (disabled) {
      multipleSelection.disable();
      Array.from(multipleSelection.main.getElementsByTagName('button')).map(button => button.setAttribute('type', 'button'));
    } else {
      multipleSelection.main.lastElementChild.onclick = listener;
    }
    pointer.selection = multipleSelection;
  });

  multipleSelection.main.setAttribute('tabindex', tabindex.toString());
  tabindex++;

  pointer.selection = multipleSelection;

  return pointer;
}

function createSubmitButton(parent, text) {
  const button = appendElement(parent, 'button', {
    id: 'submit',
    type: 'button',
    tabindex: tabindex,
  });
  tabindex++;
  button.innerHTML = text || 'Submit';

  return button;
}

createButton.onclick = function (event) {
  resetPage();

  const mainForm = appendElement(document.body, 'form', {
    class: 'mainForm',
  });

  const subGrid1 = createSubGrid(mainForm, 'Name :');
  const input = appendElement(subGrid1, 'input', {
    id: 'stackName',
    tabindex: tabindex.toString(),
  });
  tabindex++;

  const subGrid2 = createSubGrid(mainForm, 'Components :');

  const selectionId = 'componentsSelection';
  const selectionPointer = createSelection(subGrid2, selectionId, loadComponents, true, 'Loading...');

  const submit = createSubmitButton(mainForm);
  submit.onclick = function (event) {
    const stackName = input.value;
    if (!stackName) {
      return;
    }
    const components = getSelectedItems(selectionPointer.selection);
    if (components.length === 0) {
      return;
    }
    // TODO : create stack in backend
    console.log(apiBaseUrl);
    console.log(stackName);
    console.log(components);
  };
};

editButton.onclick = function (event) {
  resetPage();

  const mainForm = appendElement(document.body, 'form', {
    class: 'mainForm',
  });

  const subGrid1 = createSubGrid(mainForm, 'Stack :');
  const stackSelectionPointer = createSelection(subGrid1, 'stacksSelection', loadComponentStacks, false);

  const subGrid2 = createSubGrid(mainForm, 'Components :');
  const componentSelectionPointer = createSelection(subGrid2, 'componentsSelection', loadComponents,  true,'Choose a stack', true);

  stackSelectionPointer.selection.main.lastElementChild.onclick = function (event) {
    let selection = componentSelectionPointer.selection;

    const userOptions = selection.userOptions;
    delete userOptions.placeHolder;

    const responseValues = stackSelectionPointer.selection.responseValues;
    const stackName = getSelectedItems(stackSelectionPointer.selection)[0];
    const selectedStack = responseValues.filter(stack => stack.name === stackName)[0];
    selection = new vanillaSelectBox(selection.domSelector, userOptions);
    selection.setValue(selectedStack.components.map(component => component.short));

    componentSelectionPointer.selection = selection;
  };

  const submit = createSubmitButton(mainForm);
  submit.onclick = function (event) {
    const stackName = getSelectedItems(stackSelectionPointer.selection)[0];
    if (stackName === undefined) {
      return;
    }
    const components = getSelectedItems(componentSelectionPointer.selection);
    if (components.length === 0) {
      return;
    }
    // TODO : edit stack in backend
    console.log(apiBaseUrl);
    console.log(stackName);
    console.log(components);
  };
};

deleteButton.onclick = function (event) {
  resetPage();

  const mainForm = appendElement(document.body, 'form', {
    class: 'mainForm',
  });

  const subGrid1 = createSubGrid(mainForm, 'Stack :');
  const stackSelectionPointer = createSelection(subGrid1, 'stacksSelection', loadComponentStacks, false);

  const submit = createSubmitButton(mainForm, 'Delete');
  submit.onclick = function (event) {
    const stackName = getSelectedItems(stackSelectionPointer.selection)[0];
    if (stackName === undefined) {
      return;
    }
    // TODO : edit stack in backend
    console.log(apiBaseUrl);
    console.log(stackName);
  };
};