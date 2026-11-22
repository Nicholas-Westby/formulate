using Xunit;
using ApiEntityTypes = Formulate.BackOffice.Api.EntityTypes;
using Formulate.BackOffice.Api;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Persistence;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Persistence;
using Formulate.Core.Validations;
using Moq;

namespace Formulate.BackOffice.Tests.Api;

public class FormulateTreeServiceTests
{
    private static readonly Guid FormsRoot = Guid.Parse(FormConstants.RootId);
    private static readonly Guid DataValuesRoot = Guid.Parse(DataValuesConstants.RootId);
    private static readonly Guid ValidationsRoot = Guid.Parse(ValidationConstants.RootId);

    private readonly FakeTreeEntityRepository _repository = new();
    private readonly List<IDataValuesDefinition> _dataValuesDefinitions = new();

    private FormulateTreeService CreateService() => new(
        _repository,
        new DataValuesDefinitionCollection(() => _dataValuesDefinitions),
        new ValidationDefinitionCollection(() => Array.Empty<IValidationDefinition>()));

    private PersistedFolder AddFolder(Guid root, string name, params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var folder = new PersistedFolder { Id = id, Name = name, Alias = name, Path = Path(root, parents, id) };
        _repository.Add(folder);
        return folder;
    }

    private PersistedForm AddForm(string name, params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var form = new PersistedForm { Id = id, Name = name, Alias = name, Path = Path(FormsRoot, parents, id) };
        _repository.Add(form);
        return form;
    }

    private PersistedLayout AddLayout(string name, Guid formId)
    {
        var form = _repository.Get(formId)!;
        var id = Guid.NewGuid();
        var layout = new PersistedLayout { Id = id, Name = name, Alias = name, KindId = Guid.NewGuid(), Path = form.Path.Append(id).ToArray() };
        _repository.Add(layout);
        return layout;
    }

    private PersistedDataValues AddDataValues(string name, Guid kindId, params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var values = new PersistedDataValues { Id = id, Name = name, Alias = name, KindId = kindId, Path = Path(DataValuesRoot, parents, id) };
        _repository.Add(values);
        return values;
    }

    private PersistedValidation AddValidation(string name)
    {
        var id = Guid.NewGuid();
        var validation = new PersistedValidation { Id = id, Name = name, Alias = name, KindId = Guid.NewGuid(), Path = new[] { ValidationsRoot, id } };
        _repository.Add(validation);
        return validation;
    }

    private static Guid[] Path(Guid root, Guid[] parents, Guid id) => new[] { root }.Concat(parents).Append(id).ToArray();

    private static T Ok<T>(FormulateTreeResult<T> result)
    {
        Assert.Equal(FormulateTreeStatus.Success, result.Status);
        return result.Value!;
    }

    [Fact]
    public void Root_lists_folders_then_items_by_name()
    {
        AddForm("beta");
        AddForm("Alpha");
        AddFolder(FormsRoot, "zeta folder");
        AddFolder(FormsRoot, "Yankee folder");
        AddFolder(DataValuesRoot, "other tree folder");

        var page = Ok(CreateService().GetRoot(TreeAliases.Forms, false, 0, 100));

        Assert.Equal(new[] { "Yankee folder", "zeta folder", "Alpha", "beta" }, page.Items.Select(x => x.Name));
        Assert.Equal(4, page.Total);
        Assert.Equal(new[] { ApiEntityTypes.FormFolder, ApiEntityTypes.FormFolder, ApiEntityTypes.Form, ApiEntityTypes.Form }, page.Items.Select(x => x.EntityType));
        Assert.All(page.Items, x => Assert.Null(x.Parent));
        Assert.Equal(new[] { true, true, false, false }, page.Items.Select(x => x.IsFolder));
        Assert.Equal(new[] { "icon-folder", "icon-folder", "icon-document", "icon-document" }, page.Items.Select(x => x.Icon));
    }

    [Fact]
    public void Children_of_form_are_its_layouts()
    {
        var form = AddForm("form");
        AddLayout("second", form.Id);
        AddLayout("first", form.Id);
        var service = CreateService();

        var root = Ok(service.GetRoot(TreeAliases.Forms, false, 0, 100));
        var page = Ok(service.GetChildren(TreeAliases.Forms, form.Id, false, 0, 100));

        Assert.True(Assert.Single(root.Items).HasChildren);
        Assert.Equal(new[] { "first", "second" }, page.Items.Select(x => x.Name));
        Assert.All(page.Items, x =>
        {
            Assert.Equal(ApiEntityTypes.Layout, x.EntityType);
            Assert.Equal("icon-layout", x.Icon);
            Assert.False(x.HasChildren);
            Assert.Equal(form.Id, x.Parent!.Id);
            Assert.NotNull(x.KindId);
        });
    }

    [Fact]
    public void Children_of_folder_nest_and_report_parent()
    {
        var folder = AddFolder(FormsRoot, "folder");
        var inner = AddFolder(FormsRoot, "inner", folder.Id);
        AddForm("in folder", folder.Id);

        var page = Ok(CreateService().GetChildren(TreeAliases.Forms, folder.Id, false, 0, 100));

        Assert.Equal(new[] { "inner", "in folder" }, page.Items.Select(x => x.Name));
        Assert.All(page.Items, x => Assert.Equal(folder.Id, x.Parent!.Id));
        Assert.Equal(inner.Id, page.Items.ElementAt(0).Id);
    }

    [Fact]
    public void FoldersOnly_excludes_items()
    {
        var folder = AddFolder(FormsRoot, "folder");
        AddFolder(FormsRoot, "inner", folder.Id);
        AddForm("form at root");
        AddForm("form in folder", folder.Id);
        var service = CreateService();

        var root = Ok(service.GetRoot(TreeAliases.Forms, true, 0, 100));
        var children = Ok(service.GetChildren(TreeAliases.Forms, folder.Id, true, 0, 100));

        Assert.Equal("folder", Assert.Single(root.Items).Name);
        Assert.Equal(1, root.Total);
        Assert.True(root.Items.ElementAt(0).HasChildren);
        Assert.Equal("inner", Assert.Single(children.Items).Name);
        Assert.False(children.Items.ElementAt(0).HasChildren);
    }

    [Fact]
    public void FoldersOnly_has_no_children_for_a_folder_holding_only_items()
    {
        var folder = AddFolder(FormsRoot, "folder");
        AddForm("form", folder.Id);

        var root = Ok(CreateService().GetRoot(TreeAliases.Forms, true, 0, 100));

        Assert.False(Assert.Single(root.Items).HasChildren);
    }

    [Fact]
    public void Paging_skips_and_takes_and_reports_total()
    {
        AddFolder(FormsRoot, "folder");
        foreach (var name in new[] { "a", "b", "c", "d" })
        {
            AddForm(name);
        }

        var page = Ok(CreateService().GetRoot(TreeAliases.Forms, false, 2, 2));

        Assert.Equal(new[] { "b", "c" }, page.Items.Select(x => x.Name));
        Assert.Equal(5, page.Total);
    }

    [Fact]
    public void Paging_past_the_end_returns_an_empty_page_with_total()
    {
        AddForm("a");

        var page = Ok(CreateService().GetRoot(TreeAliases.Forms, false, 10, 5));

        Assert.Empty(page.Items);
        Assert.Equal(1, page.Total);
    }

    [Fact]
    public void Ancestors_are_root_first_and_include_self()
    {
        var outer = AddFolder(FormsRoot, "outer");
        var inner = AddFolder(FormsRoot, "inner", outer.Id);
        var form = AddForm("form", outer.Id, inner.Id);
        var layout = AddLayout("layout", form.Id);

        var ancestors = Ok(CreateService().GetAncestors(TreeAliases.Forms, layout.Id));

        Assert.Equal(new[] { outer.Id, inner.Id, form.Id, layout.Id }, ancestors.Select(x => x.Id));
        Assert.Null(ancestors[0].Parent);
        Assert.Equal(inner.Id, ancestors[2].Parent!.Id);
    }

    [Fact]
    public void Ancestors_of_a_top_level_item_are_only_itself()
    {
        var form = AddForm("form");

        var ancestors = Ok(CreateService().GetAncestors(TreeAliases.Forms, form.Id));

        Assert.Equal(form.Id, Assert.Single(ancestors).Id);
    }

    [Fact]
    public void Unknown_tree_alias_is_rejected()
    {
        var service = CreateService();

        Assert.Equal(FormulateTreeStatus.UnknownTree, service.GetRoot("nope", false, 0, 100).Status);
        Assert.Equal(FormulateTreeStatus.UnknownTree, service.GetChildren("nope", Guid.NewGuid(), false, 0, 100).Status);
        Assert.Equal(FormulateTreeStatus.UnknownTree, service.GetAncestors("nope", Guid.NewGuid()).Status);
        Assert.Equal(FormulateTreeStatus.UnknownTree, service.GetRoot("Forms", false, 0, 100).Status);
    }

    [Fact]
    public void Unknown_parent_or_descendant_is_not_found()
    {
        var service = CreateService();

        Assert.Equal(FormulateTreeStatus.NotFound, service.GetChildren(TreeAliases.Forms, Guid.NewGuid(), false, 0, 100).Status);
        Assert.Equal(FormulateTreeStatus.NotFound, service.GetAncestors(TreeAliases.Forms, Guid.NewGuid()).Status);
    }

    [Fact]
    public void Entity_from_another_tree_is_not_found()
    {
        var validation = AddValidation("validation");
        var service = CreateService();

        Assert.Equal(FormulateTreeStatus.NotFound, service.GetAncestors(TreeAliases.Forms, validation.Id).Status);
        Assert.Equal(FormulateTreeStatus.NotFound, service.GetChildren(TreeAliases.Forms, validation.Id, false, 0, 100).Status);
        Assert.Equal(FormulateTreeStatus.Success, service.GetAncestors(TreeAliases.Validations, validation.Id).Status);
    }

    [Fact]
    public void Each_tree_lists_only_its_own_items()
    {
        AddForm("form");
        AddValidation("validation");
        AddDataValues("values", Guid.NewGuid());
        var service = CreateService();

        var validations = Ok(service.GetRoot(TreeAliases.Validations, false, 0, 100));
        var dataValues = Ok(service.GetRoot(TreeAliases.DataValues, false, 0, 100));

        Assert.Equal("validation", Assert.Single(validations.Items).Name);
        Assert.Equal(ApiEntityTypes.Validation, validations.Items.ElementAt(0).EntityType);
        Assert.Equal("icon-check", validations.Items.ElementAt(0).Icon);
        Assert.Equal("values", Assert.Single(dataValues.Items).Name);
        Assert.Equal(ApiEntityTypes.DataValues, dataValues.Items.ElementAt(0).EntityType);
        Assert.Equal("icon-bulleted-list", dataValues.Items.ElementAt(0).Icon);
    }

    [Fact]
    public void Folders_take_the_entity_type_of_their_tree()
    {
        var folder = AddFolder(DataValuesRoot, "folder");

        var page = Ok(CreateService().GetRoot(TreeAliases.DataValues, false, 0, 100));

        Assert.Equal(folder.Id, Assert.Single(page.Items).Id);
        Assert.Equal(ApiEntityTypes.DataValuesFolder, page.Items.ElementAt(0).EntityType);
    }

    [Fact]
    public void Legacy_data_values_are_flagged()
    {
        var legacyKind = Guid.NewGuid();
        var currentKind = Guid.NewGuid();
        _dataValuesDefinitions.Add(Definition(legacyKind, isLegacy: true, icon: "icon-formulate-legacy"));
        _dataValuesDefinitions.Add(Definition(currentKind, isLegacy: false, icon: "icon-globe"));
        AddDataValues("a legacy", legacyKind);
        AddDataValues("b current", currentKind);
        AddDataValues("c unknown kind", Guid.NewGuid());

        var page = Ok(CreateService().GetRoot(TreeAliases.DataValues, false, 0, 100));

        Assert.Equal(new[] { true, false, false }, page.Items.Select(x => x.IsLegacy));
        Assert.Equal(new[] { "icon-bulleted-list", "icon-globe", "icon-bulleted-list" }, page.Items.Select(x => x.Icon));
        Assert.Equal(legacyKind, page.Items.ElementAt(0).KindId);
    }

    [Fact]
    public void Items_return_layout_parent_form()
    {
        var form = AddForm("My form");
        var layout = AddLayout("My layout", form.Id);
        var folder = AddFolder(FormsRoot, "folder");
        var inFolder = AddForm("In folder", folder.Id);
        var unknown = Guid.NewGuid();

        var items = CreateService().GetItems(new[] { layout.Id, unknown, form.Id, inFolder.Id });

        Assert.Equal(new[] { layout.Id, form.Id, inFolder.Id }, items.Select(x => x.Id));
        Assert.Equal(ApiEntityTypes.Layout, items[0].EntityType);
        Assert.Equal("icon-layout", items[0].Icon);
        Assert.Equal(form.Id, items[0].ParentId);
        Assert.Equal("My form", items[0].ParentName);
        Assert.Equal(layout.KindId, items[0].KindId);
        Assert.Equal(ApiEntityTypes.Form, items[1].EntityType);
        Assert.Null(items[1].ParentId);
        Assert.Null(items[1].ParentName);
        Assert.Null(items[1].KindId);
        Assert.Equal(folder.Id, items[2].ParentId);
        Assert.Equal("folder", items[2].ParentName);
    }

    [Fact]
    public void Items_keep_duplicates_in_request_order_and_ignore_none()
    {
        var form = AddForm("form");
        var service = CreateService();

        Assert.Empty(service.GetItems(Array.Empty<Guid>()));
        Assert.Equal(new[] { form.Id, form.Id }, service.GetItems(new[] { form.Id, form.Id }).Select(x => x.Id));
    }

    [Fact]
    public void Items_that_cannot_have_children_never_look_them_up()
    {
        var form = AddForm("form");
        AddLayout("layout", form.Id);
        AddValidation("validation");
        AddDataValues("values", Guid.NewGuid());
        var service = CreateService();

        var validations = Ok(service.GetRoot(TreeAliases.Validations, false, 0, 100));
        var dataValues = Ok(service.GetRoot(TreeAliases.DataValues, false, 0, 100));
        var layouts = Ok(service.GetChildren(TreeAliases.Forms, form.Id, false, 0, 100));

        Assert.False(Assert.Single(validations.Items).HasChildren);
        Assert.False(Assert.Single(dataValues.Items).HasChildren);
        Assert.False(Assert.Single(layouts.Items).HasChildren);
        Assert.Equal(0, _repository.ParentListings);
        Assert.Equal(1, _repository.ChildLookups); // Only the parent lookup of the children call.
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(60)]
    public void A_page_of_forms_lists_the_repositories_a_bounded_number_of_times(int count)
    {
        var withLayouts = AddForm("with layouts");
        AddLayout("layout", withLayouts.Id);
        for (var i = 1; i < count; i++)
        {
            AddForm("form " + i);
        }

        var page = Ok(CreateService().GetRoot(TreeAliases.Forms, false, 0, 1000));

        Assert.Equal(count, page.Total);
        Assert.Equal(1, _repository.ParentListings);
        Assert.Equal(0, _repository.ChildLookups);
        Assert.True(page.Items.Single(x => x.Id == withLayouts.Id).HasChildren);
        Assert.Equal(1, page.Items.Count(x => x.HasChildren));
    }

    [Fact]
    public void Paging_is_stable_for_equal_names()
    {
        // Added in the opposite order to their IDs, so only the ID tie-break can put them right.
        var highId = Guid.Parse("ffffffff-0000-0000-0000-000000000001");
        var lowId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        _repository.Add(new PersistedForm { Id = highId, Name = "same", Alias = "a", Path = new[] { FormsRoot, highId } });
        _repository.Add(new PersistedForm { Id = lowId, Name = "SAME", Alias = "b", Path = new[] { FormsRoot, lowId } });
        var expected = new[] { lowId, highId };
        var service = CreateService();

        var first = Ok(service.GetRoot(TreeAliases.Forms, false, 0, 1)).Items.Single().Id;
        var second = Ok(service.GetRoot(TreeAliases.Forms, false, 1, 1)).Items.Single().Id;
        var all = Ok(service.GetRoot(TreeAliases.Forms, false, 0, 10)).Items.Select(x => x.Id);

        Assert.Equal(expected, new[] { first, second });
        Assert.Equal(expected, all);
    }

    private static IDataValuesDefinition Definition(Guid kindId, bool isLegacy, string icon)
    {
        var definition = new Mock<IDataValuesDefinition>();
        definition.SetupGet(x => x.KindId).Returns(kindId);
        definition.SetupGet(x => x.IsLegacy).Returns(isLegacy);
        definition.SetupGet(x => x.Icon).Returns(icon);
        return definition.Object;
    }

    /// <summary>An in-memory stand-in for the repository, with the same tree rules as the real one.</summary>
    private sealed class FakeTreeEntityRepository : ITreeEntityRepository
    {
        private readonly List<IPersistedEntity> _entities = new();

        public void Add(IPersistedEntity entity) => _entities.Add(entity);

        public IPersistedEntity? Get(Guid? id) => _entities.FirstOrDefault(x => x.Id == id);

        /// <summary>Gets how many times a child lookup (which reads every repository) ran.</summary>
        public int ChildLookups { get; private set; }

        /// <summary>Gets how many times the parent IDs were listed.</summary>
        public int ParentListings { get; private set; }

        public IReadOnlyCollection<IPersistedEntity> GetChildren(Guid parentId)
        {
            ChildLookups++;
            return _entities.Where(x => x.Path.Length > 1 && x.Path[^2] == parentId).ToArray();
        }

        public bool HasChildren(Guid parentId, Func<IPersistedEntity, bool>? filter = null) =>
            filter is null ? GetChildren(parentId).Any() : GetChildren(parentId).Any(filter);

        public IReadOnlyCollection<Guid> GetParentIds(TreeTypes treeType, bool foldersOnly)
        {
            ParentListings++;
            return _entities
                .Where(x => x.Path.Length > 2 && (!foldersOnly || x is PersistedFolder))
                .Select(x => x.Path[^2])
                .ToHashSet();
        }

        public IReadOnlyCollection<IPersistedEntity> GetRootItems(TreeTypes treeRootType) =>
            _entities.Where(x => x.Path.Length == 2 && x.Path[0] == GetRootId(treeRootType)).ToArray();

        public Guid GetRootId(TreeTypes treeRootType) => treeRootType switch
        {
            TreeTypes.Forms => FormsRoot,
            TreeTypes.DataValues => DataValuesRoot,
            TreeTypes.Validations => ValidationsRoot,
            _ => Guid.Empty,
        };

        public IReadOnlyCollection<Guid> Delete(IPersistedEntity entity) => throw new NotSupportedException();

        public Guid[] Move(IPersistedEntity entity, Guid[] parentPath) => throw new NotSupportedException();
    }
}
