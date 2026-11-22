namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using Formulate.BackOffice.Api.Models.Item;
    using Formulate.BackOffice.Api.Models.Tree;
    using Umbraco.Cms.Api.Common.ViewModels.Pagination;

    /// <summary>
    /// Reads the Formulate trees for the Management API.
    /// </summary>
    public interface IFormulateTreeService
    {
        /// <summary>
        /// Gets a page of the items at the top of a tree.
        /// </summary>
        /// <param name="treeAlias">One of the <see cref="TreeAliases"/> values.</param>
        /// <param name="foldersOnly">True to list folders only.</param>
        /// <param name="skip">The number of items to skip, after sorting.</param>
        /// <param name="take">The number of items to return.</param>
        FormulateTreeResult<PagedViewModel<FormulateTreeItemResponseModel>> GetRoot(string treeAlias, bool foldersOnly, int skip, int take);

        /// <summary>
        /// Gets a page of the children of an item.
        /// </summary>
        /// <param name="treeAlias">One of the <see cref="TreeAliases"/> values.</param>
        /// <param name="parentId">The parent's ID.</param>
        /// <param name="foldersOnly">True to list folders only.</param>
        /// <param name="skip">The number of items to skip, after sorting.</param>
        /// <param name="take">The number of items to return.</param>
        FormulateTreeResult<PagedViewModel<FormulateTreeItemResponseModel>> GetChildren(string treeAlias, Guid parentId, bool foldersOnly, int skip, int take);

        /// <summary>
        /// Gets an item's ancestors, root-most first, ending with the item itself.
        /// </summary>
        /// <param name="treeAlias">One of the <see cref="TreeAliases"/> values.</param>
        /// <param name="descendantId">The item's ID.</param>
        FormulateTreeResult<IReadOnlyList<FormulateTreeItemResponseModel>> GetAncestors(string treeAlias, Guid descendantId);

        /// <summary>
        /// Gets items from any tree, in the order requested. Unknown IDs are left out.
        /// </summary>
        /// <param name="ids">The IDs.</param>
        IReadOnlyList<FormulateItemResponseModel> GetItems(IEnumerable<Guid> ids);
    }
}
