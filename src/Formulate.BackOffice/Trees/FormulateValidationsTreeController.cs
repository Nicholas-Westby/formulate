﻿namespace Formulate.BackOffice.Trees
{
    // Namespaces.
    using Attributes;
    using Core.Folders;
    using Core.Persistence;
    using Core.Validations;
    using Formulate.Core.Types;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Persistence;
    using System.Collections.Generic;
    using Umbraco.Cms.Core;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Core.Trees;
    using Umbraco.Cms.Web.BackOffice.Trees;

    /// <summary>
    /// The Formulate validations tree controller.
    /// </summary>
    [Tree(FormulateSection.Constants.Alias, Constants.Alias, TreeTitle = "Validation Library", SortOrder = 3)]
    [FormulateBackOfficePluginController]
    public sealed class FormulateValidationsTreeController : FormulateEntityTreeController
    {
        private readonly ValidationDefinitionCollection _validationDefinitions;

        public static class Constants
        {
            public const string Alias = "validations";

            public const string RootNodeIcon = "icon-formulate-validations";

            public const string FolderNodeIcon = "icon-formulate-validation-group";

            public const string ItemNodeIcon = "icon-formulate-validation";
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="FormulateValidationsTreeController"/> class.
        /// </summary>
        /// <inheritdoc />
        public FormulateValidationsTreeController(ValidationDefinitionCollection validationDefinitions, ITreeEntityRepository treeEntityRepository, IMenuItemCollectionFactory menuItemCollectionFactory, ILocalizedTextService localizedTextService, UmbracoApiControllerTypeCollection umbracoApiControllerTypeCollection, IEventAggregator eventAggregator) : base(treeEntityRepository, menuItemCollectionFactory, localizedTextService, umbracoApiControllerTypeCollection, eventAggregator)
        {
            _validationDefinitions = validationDefinitions;
        }

        /// <inheritdoc />
        protected override TreeRootTypes TreeRootType => TreeRootTypes.Validations;

        /// <inheritdoc />
        protected override string RootNodeIcon => Constants.RootNodeIcon;

        /// <inheritdoc />
        protected override string FolderNodeIcon => Constants.FolderNodeIcon;

        /// <inheritdoc />
        protected override string ItemNodeIcon => Constants.ItemNodeIcon;

        /// <inheritdoc />
        protected override ActionResult<MenuItemCollection> GetMenuForRoot(FormCollection queryStrings)
        {
            var menuItemCollection = MenuItemCollectionFactory.Create();

            menuItemCollection.AddCreateDialogMenuItem(LocalizedTextService);
            menuItemCollection.AddRefreshMenuItem(LocalizedTextService);

            return menuItemCollection;
        }

        /// <inheritdoc />
        protected override ActionResult<MenuItemCollection> GetMenuForEntity(IPersistedEntity entity, FormCollection queryStrings)
        {
            var menuItemCollection = MenuItemCollectionFactory.Create();

            if (entity is PersistedFolder)
            {
                menuItemCollection.AddCreateDialogMenuItem(LocalizedTextService);
                menuItemCollection.AddDeleteDialogMenuItem(LocalizedTextService);
                menuItemCollection.AddMoveDialogMenuItem(LocalizedTextService);
                menuItemCollection.AddRefreshMenuItem(LocalizedTextService);
            }

            if (entity is PersistedValidation)
            {
                menuItemCollection.AddDeleteDialogMenuItem(LocalizedTextService);
                menuItemCollection.AddMoveDialogMenuItem(LocalizedTextService);
            }

            return menuItemCollection;
        }

        /// <inheritdoc />
        protected override TreeNodeMetaData GetNodeMetaData(IPersistedEntity entity)
        {
            if (entity is PersistedValidation validationEntity)
            {
                var definition = _validationDefinitions.FirstOrDefault(validationEntity.KindId);

                if (definition is not null)
                {
                    return new TreeNodeMetaData(ItemNodeIcon, definition.IsLegacy);
                }
            }

            return base.GetNodeMetaData(entity);
        }

        /// <inheritdoc />
        protected override void SetAdditionalNodeData(IPersistedEntity entity,
            IDictionary<string, object> data)
        {
            var validation = entity as PersistedValidation;
            if (validation != null)
            {
                data["NodeKindId"] = validation.KindId;
            }
        }
    }
}