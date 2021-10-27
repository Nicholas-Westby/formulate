﻿using Formulate.BackOffice.Attributes;
using Formulate.BackOffice.Persistence;
using Formulate.Core.ConfiguredForms;
using Formulate.Core.Persistence;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Trees;
using Umbraco.Cms.Web.BackOffice.Trees;

namespace Formulate.BackOffice.Trees
{
    [Tree(FormulateSection.Constants.Alias, "forms", TreeTitle = "Forms", SortOrder = 0)]
    [FormulatePluginController]
    public sealed class FormulateFormsTreeController : FormulateTreeController
    {
        public FormulateFormsTreeController(ITreeEntityPersistence treeEntityPersistence, IMenuItemCollectionFactory menuItemCollectionFactory, ILocalizedTextService localizedTextService, UmbracoApiControllerTypeCollection umbracoApiControllerTypeCollection, IEventAggregator eventAggregator) : base(treeEntityPersistence, menuItemCollectionFactory, localizedTextService, umbracoApiControllerTypeCollection, eventAggregator)
        {
        }

        protected override string GetNodeAction(IPersistedEntity entity)
        {
            if (entity is PersistedConfiguredForm)
            {
                return "editConfiguredForm";
            }

            return base.GetNodeAction(entity);
        }

        protected override string GetNodeIcon(IPersistedEntity entity)
        {
            if (entity is PersistedConfiguredForm)
            {
                return "icon-formulate-conform";
            }

            return base.GetNodeIcon(entity);
        }

        protected override FormulateEntityTypes EntityType => FormulateEntityTypes.Forms;

        protected override string RootNodeIcon => "icon-formulate-forms";
        protected override string FolderNodeIcon => "icon-formulate-form-group";
        protected override string ItemNodeIcon => "icon-formulate-form";

        protected override string ItemNodeAction => "editForm";
    }
}