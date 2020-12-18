const apiBaseUrl = window.location.href

let tabindex = 1;

// TODO : for testing purpose
const components = [ 'Kubernetes', 'Docker', 'Helm' ];
const componentStacks = [ 'Stack1', 'Stack2', 'Stack3' ];
const companies = [ 'Google', 'Amazon', 'Microsoft' ];
const companyStacks = [ 'Group1', 'Group2', 'Group3' ];

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

function createSelection(parent, id, callback, multiple, placeholder) {
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
    for (const value of values) {
      const option = document.createElement('option');
      option.setAttribute('value', value);
      option.innerHTML = value;
      select.append(option);
    }
    multipleSelection.destroy();

    delete selectionOptions.placeHolder;
    const localTabindex = multipleSelection.main.getAttribute('tabindex');
    multipleSelection = new vanillaSelectBox(`#${id}`, selectionOptions);
    multipleSelection.main.setAttribute('tabindex', localTabindex);
    pointer.selection = multipleSelection;
  });

  multipleSelection.main.setAttribute('tabindex', tabindex.toString());
  tabindex++;

  pointer.selection = multipleSelection;

  return pointer;
}

async function loadComponents() {
  return components;
}

async function loadComponentStacks() {
  return componentStacks;
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
  const selectionPointer = createSelection(subGrid2, selectionId, loadComponents, 'Loading...');

  const submit = appendElement(mainForm, 'button', {
    id: 'submit',
    type: 'button',
    tabindex: tabindex,
  });
  tabindex++;
  submit.innerHTML = 'Submit';

  submit.onclick = function (event) {
    // TODO : create stack in backend
    console.log(selectionPointer.selection);
    const stackName = input.value;
    console.log(apiBaseUrl);
    console.log(stackName);
  };
};

editButton.onclick = function (event) {
  resetPage();

  const mainForm = appendElement(document.body, 'form', {
    class: 'mainForm',
  });

  const subGrid1 = createSubGrid(mainForm, 'Choose stack :');

  const selectionId = 'stacksSelection';
  const selectionPointer = createSelection(subGrid1, selectionId, loadComponentStacks, false);
};